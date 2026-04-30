"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";
import { X } from "lucide-react";
import { updateStreak } from "@/lib/streaks";
import StreakDisplay from "@/components/StreakDisplay";
import { checkStreakReminders } from "@/lib/streaks";
import Leaderboard from "@/components/Leaderboard";

type Client = {
  id: string;
  full_name: string;
  calorie_target: number | null;
  protein_g: number | null;
  profile_id: string | null;
  onboarding_complete: boolean | null;
  daily_step_target: number;
};

type ClientProgram = {
  id: string;
  program_start_date: string | null;
  current_week: number;
};

type ClientProgramDay = {
  id: string;
  client_program_id: string;
  day_name: string | null;
  sort_order: number | null;
  completed: boolean | null;
};

type ClientProgramDayExercise = {
  id: string;
  client_program_day_id: string;
  sets: number | null;
};

type ClientProgramSetLog = {
  id: string;
  client_program_day_exercise_id: string;
  completed: boolean;
};

type WeightLog = {
  id: string;
  weight_kg: number;
  log_date: string;
  note: string | null;
};

type DailyTracking = {
  id: string;
  water_completed: boolean;
  steps_logged: number | null;
};

type MilestoneConfig = {
  id: string;
  week_number: number;
  requires_questionnaire: boolean;
  requires_photos: boolean;
  questionnaire_questions: Array<{
    question: string;
    type: "text" | "number" | "radio";
    options?: string[];
  }>;
};

type ClientMilestone = {
  id: string;
  client_id: string;
  program_week: number;
  questionnaire_completed: boolean;
  questionnaire_responses: Record<string, any> | null;
  photos_completed: boolean;
  photo_log_date: string | null;
};

type ProgressPhoto = {
  id: string;
  image_url: string;
  log_date: string;
  photo_type: "front" | "back" | "side";
};

export default function ClientDashboardPage() {
  const [client, setClient] = useState<Client | null>(null);
  const [clientProgram, setClientProgram] = useState<ClientProgram | null>(null);
  const [currentDay, setCurrentDay] = useState<ClientProgramDay | null>(null);
  const [dayExercises, setDayExercises] = useState<ClientProgramDayExercise[]>([]);
  const [setLogs, setSetLogs] = useState<ClientProgramSetLog[]>([]);
  const [todayCalories, setTodayCalories] = useState(0);
  const [latestWeight, setLatestWeight] = useState<WeightLog | null>(null);
  const [loading, setLoading] = useState(true);

  const [dailyTracking, setDailyTracking] = useState<DailyTracking | null>(null);
  const [stepsInput, setStepsInput] = useState("");
  const [savingSteps, setSavingSteps] = useState(false);
  const [togglingWater, setTogglingWater] = useState(false);

  // Milestone state
  const [milestoneConfig, setMilestoneConfig] = useState<MilestoneConfig | null>(null);
  const [clientMilestone, setClientMilestone] = useState<ClientMilestone | null>(null);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<number, any>>({});
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [sideFile, setSideFile] = useState<File | null>(null);
  const [submittingMilestone, setSubmittingMilestone] = useState(false);

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  const completedExercises = useMemo(() => {
    return dayExercises.filter((exercise) => {
      const targetSets = exercise.sets ?? 0;
      if (targetSets === 0) return false;

      const completedSets = setLogs.filter(
        (log) =>
          log.client_program_day_exercise_id === exercise.id && log.completed
      ).length;

      return completedSets >= targetSets;
    }).length;
  }, [dayExercises, setLogs]);

  const totalExercises = dayExercises.length;

  const caloriesRemaining =
    client?.calorie_target !== null && client?.calorie_target !== undefined
      ? client.calorie_target - todayCalories
      : null;

  const checkMilestone = async (clientId: string, currentWeek: number) => {
    // Check if there's a milestone config for this week
    const { data: config } = await supabase
      .from("milestone_config")
      .select("*")
      .eq("week_number", currentWeek)
      .maybeSingle();

    if (!config) return; // No milestone this week

    // Check if client has already completed this milestone
    const { data: existing } = await supabase
      .from("client_milestones")
      .select("*")
      .eq("client_id", clientId)
      .eq("program_week", currentWeek)
      .maybeSingle();

    if (existing) {
      // Check if it's complete
      const questionnaireComplete = !config.requires_questionnaire || existing.questionnaire_completed;
      const photosComplete = !config.requires_photos || existing.photos_completed;
      
      if (questionnaireComplete && photosComplete) {
        return; // Milestone fully complete
      }

      // Milestone exists but incomplete
      setClientMilestone(existing);
      setMilestoneConfig(config);
      setShowMilestoneModal(true);
    } else {
      // Create new milestone record
      const { data: newMilestone } = await supabase
        .from("client_milestones")
        .insert([
          {
            client_id: clientId,
            program_week: currentWeek,
            questionnaire_completed: false,
            photos_completed: false,
          },
        ])
        .select()
        .single();

      if (newMilestone) {
        setClientMilestone(newMilestone);
        setMilestoneConfig(config);
        setShowMilestoneModal(true);
      }
    }
  };

  const loadDashboard = async () => {
    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

if (userError || !user) {
  setClient(null);
  setLoading(false);
  return;
}

const { data: clientData, error: clientError } = await supabase
  .from("clients")
  .select("*")
  .eq("profile_id", user.id)
  .single();

if (clientError || !clientData) {
  setClient(null);
  setLoading(false);
  return;
}

if (clientData.onboarding_complete === false) {
  window.location.href = "/onboarding";
  return;
}

setClient(clientData);

// ✅ Check for streak reminders AFTER clientData is loaded
await checkStreakReminders(clientData.id);

    if (clientError || !clientData) {
      setClient(null);
      setLoading(false);
      return;
    }

    if (clientData.onboarding_complete === false) {
      window.location.href = "/onboarding";
      return;
    }

    setClient(clientData);

    // Load daily tracking
    const { data: trackingData } = await supabase
      .from("daily_tracking")
      .select("*")
      .eq("client_id", clientData.id)
      .eq("log_date", today)
      .maybeSingle();

    if (trackingData) {
      setDailyTracking(trackingData);
      setStepsInput(trackingData.steps_logged?.toString() ?? "");
    } else {
      setDailyTracking(null);
      setStepsInput("");
    }

    const { data: weightData } = await supabase
      .from("client_weight_logs")
      .select("*")
      .eq("client_id", clientData.id)
      .order("log_date", { ascending: false })
      .limit(1);

    setLatestWeight(weightData && weightData.length > 0 ? weightData[0] : null);

    const { data: clientProgramData, error: clientProgramError } = await supabase
      .from("client_programs")
      .select("*")
      .eq("client_id", clientData.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!clientProgramError && (!clientProgramData || clientProgramData.length === 0)) {
      window.location.href = "/onboarding";
      return;
    }

    if (!clientProgramError && clientProgramData && clientProgramData.length > 0) {
      const program = clientProgramData[0];
      setClientProgram(program);

      // Calculate current week if program has started
      if (program.program_start_date) {
        const startDate = new Date(program.program_start_date);
        const todayDate = new Date();
        const daysSinceStart = Math.floor(
          (todayDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const calculatedWeek = Math.floor(daysSinceStart / 7) + 1;

        // Update week if changed
        if (calculatedWeek !== program.current_week) {
          await supabase
            .from("client_programs")
            .update({ current_week: calculatedWeek })
            .eq("id", program.id);

          program.current_week = calculatedWeek;
        }

        // Check for milestone
        await checkMilestone(clientData.id, calculatedWeek);
      }

      const { data: daysData, error: daysError } = await supabase
        .from("client_program_days")
        .select("*")
        .eq("client_program_id", program.id)
        .order("sort_order", { ascending: true });

      if (!daysError && daysData && daysData.length > 0) {
        const firstIncompleteDay =
          daysData.find((day) => !day.completed) ?? daysData[0];

        setCurrentDay(firstIncompleteDay);

        const { data: exerciseData, error: exerciseError } = await supabase
          .from("client_program_day_exercises")
          .select("id, client_program_day_id, sets")
          .eq("client_program_day_id", firstIncompleteDay.id)
          .order("sort_order", { ascending: true });

        if (!exerciseError && exerciseData) {
          setDayExercises(exerciseData);

          const exerciseIds = exerciseData.map((e) => e.id);

          if (exerciseIds.length > 0) {
            const { data: setLogData, error: setLogError } = await supabase
              .from("client_program_set_logs")
              .select("id, client_program_day_exercise_id, completed")
              .eq("client_id", clientData.id)
              .eq("client_program_day_id", firstIncompleteDay.id)
              .in("client_program_day_exercise_id", exerciseIds);

            setSetLogs(!setLogError && setLogData ? setLogData : []);
          } else {
            setSetLogs([]);
          }
        } else {
          setDayExercises([]);
          setSetLogs([]);
        }
      } else {
        setCurrentDay(null);
        setDayExercises([]);
        setSetLogs([]);
      }
    } else {
      setCurrentDay(null);
      setDayExercises([]);
      setSetLogs([]);
    }

    let recipeCaloriesTotal = 0;
    let customCaloriesTotal = 0;

    const { data: mealData } = await supabase
      .from("meal_logs")
      .select("quantity, recipes(calories)")
      .eq("client_id", clientData.id)
      .eq("log_date", today)
      .eq("completed", true);

    if (mealData) {
      recipeCaloriesTotal = mealData.reduce((sum: number, item: any) => {
        const recipeCalories = Array.isArray(item.recipes)
          ? item.recipes[0]?.calories
          : item.recipes?.calories;

        const quantity = item.quantity ?? 1;
        return sum + (recipeCalories ?? 0) * quantity;
      }, 0);
    }

    const { data: customMealData } = await supabase
      .from("custom_meal_logs")
      .select("calories")
      .eq("client_id", clientData.id)
      .eq("log_date", today);

    if (customMealData) {
      customCaloriesTotal = customMealData.reduce(
        (sum, meal) => sum + (meal.calories ?? 0),
        0
      );
    }

    setTodayCalories(recipeCaloriesTotal + customCaloriesTotal);
    setLoading(false);
  };

  const handleSaveSteps = async () => {
    if (!client) return;

    const steps = parseInt(stepsInput);
    if (isNaN(steps) || steps < 0) {
      alert("Please enter a valid step count");
      return;
    }

    setSavingSteps(true);

    if (dailyTracking) {
      const { error } = await supabase
        .from("daily_tracking")
        .update({ steps_logged: steps })
        .eq("id", dailyTracking.id);

      if (error) {
        alert("Error saving steps");
        setSavingSteps(false);
        return;
      }

      setDailyTracking({ ...dailyTracking, steps_logged: steps });
    } else {
      const { data, error } = await supabase
        .from("daily_tracking")
        .insert({
          client_id: client.id,
          log_date: today,
          steps_logged: steps,
          water_completed: false,
        })
        .select()
        .single();

      if (error) {
        alert("Error saving steps");
        setSavingSteps(false);
        return;
      }

      setDailyTracking(data);
    }

    setSavingSteps(false);
  };

const handleToggleWater = async () => {
  if (!client) return;

  setTogglingWater(true);

  const newWaterStatus = !dailyTracking?.water_completed;

  if (dailyTracking) {
    const { error } = await supabase
      .from("daily_tracking")
      .update({ water_completed: newWaterStatus })
      .eq("id", dailyTracking.id);

    if (error) {
      alert("Error updating water");
      setTogglingWater(false);
      return;
    }

    setDailyTracking({ ...dailyTracking, water_completed: newWaterStatus });
  } else {
    const { data, error } = await supabase
      .from("daily_tracking")
      .insert({
        client_id: client.id,
        log_date: today,
        water_completed: newWaterStatus,
        steps_logged: null,
      })
      .select()
      .single();

    if (error) {
      alert("Error updating water");
      setTogglingWater(false);
      return;
    }

    setDailyTracking(data);
  }

  // 🔥 UPDATE WATER STREAK
  if (newWaterStatus) {
    await updateStreak(client.id, "water", today);
  }

  setTogglingWater(false);
};

  const handleSubmitMilestone = async () => {
    if (!client || !clientMilestone || !milestoneConfig) return;

    // Validate questionnaire
    if (milestoneConfig.requires_questionnaire) {
      const allAnswered = milestoneConfig.questionnaire_questions.every((_, index) => {
        return questionnaireAnswers[index] !== undefined && questionnaireAnswers[index] !== "";
      });

      if (!allAnswered) {
        alert("Please answer all questions");
        return;
      }
    }

    // Validate photos
    if (milestoneConfig.requires_photos) {
      if (!frontFile || !backFile || !sideFile) {
        alert("Please upload all 3 photos (Front, Back, Side)");
        return;
      }
    }

    setSubmittingMilestone(true);

    try {
      let photoLogDate = clientMilestone.photo_log_date;

      // Upload photos if required
      if (milestoneConfig.requires_photos && frontFile && backFile && sideFile) {
        const uploads: Array<{ type: "front" | "back" | "side"; file: File }> = [
          { type: "front", file: frontFile },
          { type: "back", file: backFile },
          { type: "side", file: sideFile },
        ];

        photoLogDate = today;

        for (const { type, file } of uploads) {
          const fileExt = file.name.split(".").pop();
          const filePath = `${client.id}/${today}-${type}-milestone-week${milestoneConfig.week_number}-${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from("progress-photos")
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data: publicUrlData } = supabase.storage
            .from("progress-photos")
            .getPublicUrl(filePath);

          const imageUrl = publicUrlData.publicUrl;

          const { error: dbError } = await supabase
            .from("progress_photos")
            .insert([
              {
                client_id: client.id,
                image_url: imageUrl,
                log_date: photoLogDate,
                photo_type: type,
                note: `Week ${milestoneConfig.week_number} milestone`,
              },
            ]);

          if (dbError) throw dbError;
        }
      }

      // Update milestone
      const { error: updateError } = await supabase
        .from("client_milestones")
        .update({
          questionnaire_completed: milestoneConfig.requires_questionnaire,
          questionnaire_responses: milestoneConfig.requires_questionnaire
            ? questionnaireAnswers
            : null,
          photos_completed: milestoneConfig.requires_photos,
          photo_log_date: photoLogDate,
          completed_at: new Date().toISOString(),
        })
        .eq("id", clientMilestone.id);

      if (updateError) throw updateError;

      alert(`Week ${milestoneConfig.week_number} milestone complete! Great work!`);
      setShowMilestoneModal(false);
      setQuestionnaireAnswers({});
      setFrontFile(null);
      setBackFile(null);
      setSideFile(null);
    } catch (error: any) {
      alert(`Error submitting milestone: ${error.message}`);
    } finally {
      setSubmittingMilestone(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [today]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

{/* Streaks & Achievements */}
{client && (
  <div className="mt-6">
    <StreakDisplay clientId={client.id} />
  </div>
)}

{/* Leaderboard */}
{client && (
  <div className="mt-6">
    <Leaderboard currentClientId={client.id} />
  </div>
)}

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className={styles.display}>Dashboard</h1>
        <button onClick={handleLogout} className={styles.buttonPrimary}>
          Logout
        </button>
      </div>

      {loading ? (
        <p className={styles.body}>Loading dashboard...</p>
      ) : !client ? (
        <p className={styles.body}>Client not found.</p>
      ) : (
        <div className="space-y-4">
          <div className={styles.card}>
            <h2 className={`text-2xl font-semibold ${styles.goldText}`}>
              Welcome, {client.full_name}
            </h2>
            <p className={`mt-2 ${styles.body}`}>
              Here's your progress for today.
            </p>
            {clientProgram?.current_week && clientProgram.current_week > 0 && (
              <p className="mt-2 text-sm text-ink-muted">
                You're currently in Week {clientProgram.current_week}
              </p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Workout Card with Steps */}
            <div className="rounded-lg bg-surface-sunken p-5 shadow-subtle">
              <Link href="/client/workout" className="block">
                <p className="text-sm text-ink-muted">Today's Workout</p>
                <p className="mt-1 text-lg font-semibold text-ink">
                  {currentDay?.day_name || "No active programme day"}
                </p>
                <p className="mt-2 text-sm text-ink-muted">
                  {completedExercises} of {totalExercises} exercises complete
                </p>
              </Link>

              <div className="mt-4 border-t border-border-subtle pt-4">
                <p className="text-sm font-medium text-ink">Today's Steps</p>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    value={stepsInput}
                    onChange={(e) => setStepsInput(e.target.value)}
                    placeholder="0"
                    className="flex-1 rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-ink"
                  />
                  <span className="text-sm text-ink-muted">
                    / {client.daily_step_target.toLocaleString()}
                  </span>
                  <button
                    onClick={handleSaveSteps}
                    disabled={savingSteps}
                    className={styles.buttonPrimaryWorkout}
                  >
                    {savingSteps ? "Saving..." : "Save"}
                  </button>
                </div>
                {dailyTracking?.steps_logged !== null && (
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-navy transition-all"
                      style={{
                        width: `${Math.min(
                          ((dailyTracking?.steps_logged ?? 0) /
                            client.daily_step_target) *
                            100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Nutrition Card with Water */}
            <div className="rounded-lg bg-surface-sunken p-5 shadow-subtle">
              <Link href="/client/nutrition" className="block">
                <p className="text-sm text-ink-muted">Food Eaten Today</p>
                <p className="mt-1 text-lg font-semibold text-ink">
                  {todayCalories} / {client.calorie_target ?? "-"} kcal
                </p>

                {client.calorie_target ? (
                  <>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white">
                      <div
                        className={`h-full rounded-full transition-all ${
                          Math.abs(client.calorie_target - todayCalories) <= 100
                            ? "bg-emerald"
                            : Math.abs(client.calorie_target - todayCalories) <= 300
                            ? "bg-amber-500"
                            : "bg-red-500"
                        }`}
                        style={{
                          width: `${Math.min(
                            (todayCalories / client.calorie_target) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="mt-2 text-sm text-ink-muted">
                      {caloriesRemaining !== null && caloriesRemaining >= 0
                        ? `${caloriesRemaining} kcal remaining`
                        : `${Math.abs(caloriesRemaining ?? 0)} kcal over target`}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-ink-muted">No calorie target set</p>
                )}
              </Link>

              <div className="mt-4 border-t border-border-subtle pt-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-ink">Water (2L target)</p>
                  <button
                    onClick={handleToggleWater}
                    disabled={togglingWater}
                    className={
                      dailyTracking?.water_completed
                        ? styles.buttonPrimaryNutrition
                        : styles.buttonSecondary
                    }
                  >
                    {togglingWater
                      ? "..."
                      : dailyTracking?.water_completed
                      ? "✓ Complete"
                      : "Mark Complete"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <Link
            href="/client/stats"
            className={`${styles.cardInteractive} bg-surface-sunken block`}
          >
            <p className="text-sm text-ink-muted">My Stats</p>
            <p className="mt-1 text-lg font-semibold text-ink">
              {latestWeight
                ? `Latest weight: ${latestWeight.weight_kg} kg`
                : "Track weight, measurements, and progress photos"}
            </p>

            <div className="mt-3 h-20 rounded-xl bg-white/70 p-3">
              <div className="flex h-full items-end gap-2">
                <div className="w-1/6 rounded-t bg-gold" style={{ height: "35%" }} />
                <div className="w-1/6 rounded-t bg-gold" style={{ height: "55%" }} />
                <div className="w-1/6 rounded-t bg-gold" style={{ height: "48%" }} />
                <div className="w-1/6 rounded-t bg-gold" style={{ height: "70%" }} />
                <div className="w-1/6 rounded-t bg-gold" style={{ height: "62%" }} />
                <div className="w-1/6 rounded-t bg-gold" style={{ height: "82%" }} />
              </div>
            </div>

            <p className="mt-2 text-sm text-ink-muted">
              View graphs, measurements, and photos
            </p>
          </Link>
        </div>
      )}

      {/* Milestone Modal */}
      {showMilestoneModal && milestoneConfig && clientMilestone && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className={`${styles.card} w-full max-w-2xl max-h-[90vh] overflow-y-auto`}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className={styles.h2}>Week {milestoneConfig.week_number} Milestone</h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Complete this milestone to continue your program
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-6">
              {/* Questionnaire */}
              {milestoneConfig.requires_questionnaire && (
                <div>
                  <h3 className="mb-3 font-semibold text-ink">Questionnaire</h3>
                  <div className="space-y-4">
                    {milestoneConfig.questionnaire_questions.map((q, index) => (
                      <div key={index}>
                        <label className="text-sm font-medium text-ink">
                          {index + 1}. {q.question}
                        </label>

                        {q.type === "text" && (
                          <textarea
                            value={questionnaireAnswers[index] || ""}
                            onChange={(e) =>
                              setQuestionnaireAnswers({
                                ...questionnaireAnswers,
                                [index]: e.target.value,
                              })
                            }
                            className={`${styles.input} mt-2`}
                            rows={3}
                            placeholder="Your answer..."
                          />
                        )}

                        {q.type === "number" && (
                          <input
                            type="number"
                            value={questionnaireAnswers[index] || ""}
                            onChange={(e) =>
                              setQuestionnaireAnswers({
                                ...questionnaireAnswers,
                                [index]: e.target.value,
                              })
                            }
                            className={`${styles.input} mt-2`}
                            placeholder="Enter number..."
                          />
                        )}

                        {q.type === "radio" && q.options && (
                          <div className="mt-2 space-y-2">
                            {q.options.map((option) => (
                              <label key={option} className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`question-${index}`}
                                  value={option}
                                  checked={questionnaireAnswers[index] === option}
                                  onChange={(e) =>
                                    setQuestionnaireAnswers({
                                      ...questionnaireAnswers,
                                      [index]: e.target.value,
                                    })
                                  }
                                  className="h-4 w-4"
                                />
                                <span className="text-sm text-ink">{option}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Photos */}
              {milestoneConfig.requires_photos && (
                <div>
                  <h3 className="mb-3 font-semibold text-ink">Progress Photos</h3>
                  <p className="mb-3 text-sm text-ink-muted">
                    Upload Front, Back, and Side photos
                  </p>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <label className="text-sm font-medium text-ink">Front Photo</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setFrontFile(e.target.files?.[0] || null)}
                        className={`${styles.input} pt-2`}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-ink">Back Photo</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setBackFile(e.target.files?.[0] || null)}
                        className={`${styles.input} pt-2`}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-ink">Side Photo</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setSideFile(e.target.files?.[0] || null)}
                        className={`${styles.input} pt-2`}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmitMilestone}
                disabled={submittingMilestone}
                className={`${styles.buttonPrimary} w-full disabled:opacity-50`}
              >
                {submittingMilestone ? "Submitting..." : "Submit Milestone"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}