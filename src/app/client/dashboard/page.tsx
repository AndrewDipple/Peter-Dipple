"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";
import { getMondayOf, todayStr } from "@/lib/dates";
import { updateStreak, checkStreakReminders } from "@/lib/streaks";
import TourModal from "@/components/TourModal";
import MessageTrainerBox from "@/components/MessageTrainerBox";
import ClientUnreadRepliesBanner from "@/components/ClientUnreadRepliesBanner";
import ThisWeekWorkouts from "@/components/ThisWeekWorkouts";
import WeeklyCheckInCard from "@/components/WeeklyCheckInCard";
import GuideLink from "@/components/GuideLink";
import { hasAcceptedCurrentLegal } from "@/lib/legal";
import {
  getActiveCompanionView,
  isCompanionEnabledForClient,
  awardBondXp,
  COMPANION_XP_REWARDS,
  type ActiveCompanionView,
} from "@/lib/companions";
// import StreakDisplay from "@/components/StreakDisplay"; // Hidden for launch â€” see commit notes.
// import Leaderboard from "@/components/Leaderboard";     // Removed for launch â€” competitive mechanics deferred.
import { CalendarClock, Sparkles } from "lucide-react";

type Client = {
  id: string;
  full_name: string;
  calorie_target: number | null;
  protein_g: number | null;
  profile_id: string | null;
  onboarding_complete: boolean | null;
  onboarding_completed_at?: string | null;
  created_at?: string | null;
  tour_completed_at: string | null;  // NEW
  daily_step_target: number;
  terms_accepted_at?: string | null;
  privacy_accepted_at?: string | null;
  health_data_consent_at?: string | null;
  terms_version?: string | null;
  privacy_version?: string | null;
};

function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-surface-sunken ${className}`}
      aria-hidden="true"
    />
  );
}

function DashboardSkeleton() {
  return (
    <div className="w-full min-w-0 space-y-4" aria-label="Loading dashboard">
      <div className={`${styles.card} min-w-0`}>
        <SkeletonBlock className="h-7 w-2/3 max-w-sm" />
        <SkeletonBlock className="mt-3 h-4 w-52" />
        <SkeletonBlock className="mt-5 h-10 w-48" />
      </div>

      <div className="grid w-full min-w-0 gap-4 md:grid-cols-2">
        <div className="rounded-lg bg-surface-sunken p-5 shadow-subtle">
          <SkeletonBlock className="h-4 w-32 bg-surface" />
          <SkeletonBlock className="mt-3 h-7 w-44 bg-surface" />
          <SkeletonBlock className="mt-4 h-2 w-full bg-surface" />
          <SkeletonBlock className="mt-5 h-10 w-32 bg-surface" />
        </div>

        <div className="rounded-lg bg-surface-sunken p-5 shadow-subtle">
          <SkeletonBlock className="h-4 w-36 bg-surface" />
          <SkeletonBlock className="mt-3 h-7 w-40 bg-surface" />
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <SkeletonBlock className="h-16 bg-surface" />
            <SkeletonBlock className="h-16 bg-surface" />
            <SkeletonBlock className="h-16 bg-surface" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className={styles.card}>
          <SkeletonBlock className="h-6 w-48" />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <SkeletonBlock className="h-24" />
            <SkeletonBlock className="h-24" />
            <SkeletonBlock className="h-24" />
          </div>
        </div>

        <div className={styles.card}>
          <SkeletonBlock className="h-6 w-40" />
          <SkeletonBlock className="mt-4 h-32 w-full" />
        </div>
      </div>
    </div>
  );
}

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

type ClientWorkoutCompletion = {
  id: string;
  client_id: string;
  client_program_id: string;
  client_program_day_id: string;
  completed_date: string;
  completed_at: string | null;
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

type PtSessionRequest = {
  id: string;
  client_id: string;
  preferred_start_at: string;
  client_note: string | null;
  status: "requested" | "confirmed" | "alternative_suggested" | "cancelled" | "declined";
  trainer_response: string | null;
  proposed_start_at: string | null;
  confirmed_start_at: string | null;
  created_at: string;
};

const getNextWorkoutDay = (
  days: ClientProgramDay[],
  completions: ClientWorkoutCompletion[]
) => {
  if (days.length === 0) return null;

  const sortedDays = [...days].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );

  const latestCompletion = [...completions].sort((a, b) => {
    const dateCompare = b.completed_date.localeCompare(a.completed_date);
    if (dateCompare !== 0) return dateCompare;
    return (b.completed_at ?? "").localeCompare(a.completed_at ?? "");
  })[0];

  if (!latestCompletion) return sortedDays[0];

  const completedDayIndex = sortedDays.findIndex(
    (day) => day.id === latestCompletion.client_program_day_id
  );

  if (completedDayIndex === -1) return sortedDays[0];

  return sortedDays[(completedDayIndex + 1) % sortedDays.length];
};

export default function ClientDashboardPage() {
  const router = useRouter();
  const lastDashboardLoadAtRef = useRef(0);

  const [client, setClient] = useState<Client | null>(null);
  const [clientProgram, setClientProgram] = useState<ClientProgram | null>(null);
  const [currentDay, setCurrentDay] = useState<ClientProgramDay | null>(null);
  const [programDays, setProgramDays] = useState<ClientProgramDay[]>([]);
  const [workoutCompletions, setWorkoutCompletions] = useState<ClientWorkoutCompletion[]>([]);
  const [dayExercises, setDayExercises] = useState<ClientProgramDayExercise[]>([]);
  const [setLogs, setSetLogs] = useState<ClientProgramSetLog[]>([]);
  const [todayCalories, setTodayCalories] = useState(0);
  const [latestWeight, setLatestWeight] = useState<WeightLog | null>(null);
  const [loading, setLoading] = useState(true);

  const [dailyTracking, setDailyTracking] = useState<DailyTracking | null>(null);
  const [stepsInput, setStepsInput] = useState("");
  const [savingSteps, setSavingSteps] = useState(false);
  const [togglingWater, setTogglingWater] = useState(false);

  const [milestoneConfig, setMilestoneConfig] = useState<MilestoneConfig | null>(null);
  const [clientMilestone, setClientMilestone] = useState<ClientMilestone | null>(null);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<number, any>>({});
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [sideFile, setSideFile] = useState<File | null>(null);
  const [submittingMilestone, setSubmittingMilestone] = useState(false);

  // Companion widget state â€” only populated if companion feature is enabled.
  const [companionView, setCompanionView] = useState<ActiveCompanionView | null>(null);
  const [companionEnabled, setCompanionEnabled] = useState(false);
  const [ptRequests, setPtRequests] = useState<PtSessionRequest[]>([]);
  const [preferredPtDateTime, setPreferredPtDateTime] = useState("");
  const [ptRequestNote, setPtRequestNote] = useState("");
  const [submittingPtRequest, setSubmittingPtRequest] = useState(false);

const today = useMemo(() => todayStr(), []);
  const weekStart = useMemo(() => getMondayOf(today), [today]);
  const companionDisplayName = companionView
    ? companionView.companion.custom_name ??
      companionView.path.default_name ??
      companionView.path.name
    : null;

  const formatSessionDateTime = (value: string | null | undefined) => {
    if (!value) return "-";
    return new Date(value).toLocaleString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

const [showTour, setShowTour] = useState(false);

  const completedExercises = useMemo(() => {
    return dayExercises.filter((exercise) => {
      const targetSets = exercise.sets ?? 0;
      if (targetSets === 0) return false;

      const completedSets = setLogs.filter(
        (log) => log.client_program_day_exercise_id === exercise.id && log.completed
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
    const { data: config } = await supabase
      .from("milestone_config")
      .select("*")
      .eq("week_number", currentWeek)
      .maybeSingle();

    if (!config) return;

    const { data: existing } = await supabase
      .from("client_milestones")
      .select("*")
      .eq("client_id", clientId)
      .eq("program_week", currentWeek)
      .maybeSingle();

    if (existing) {
      const questionnaireComplete =
        !config.requires_questionnaire || existing.questionnaire_completed;
      const photosComplete = !config.requires_photos || existing.photos_completed;

      if (questionnaireComplete && photosComplete) return;

      setClientMilestone(existing);
      setMilestoneConfig(config);
      setShowMilestoneModal(true);
      return;
    }

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
  };

  const loadDashboard = async () => {
    lastDashboardLoadAtRef.current = Date.now();
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

    if (!hasAcceptedCurrentLegal(clientData)) {
      router.replace("/client/terms");
      return;
    }

    if (clientData.onboarding_complete === false) {
      router.replace("/onboarding");
      return;
    }

    setClient(clientData);

    // Show the tour for clients who haven't seen it yet.
if (!clientData.tour_completed_at) {
  setShowTour(true);
}
    await checkStreakReminders(clientData.id);

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
      .or("status.eq.active,status.is.null")
      .order("created_at", { ascending: false })
      .limit(1);

    if (!clientProgramError && (!clientProgramData || clientProgramData.length === 0)) {
      router.replace("/onboarding");
      return;
    }

    if (!clientProgramError && clientProgramData && clientProgramData.length > 0) {
      const program = clientProgramData[0];
      setClientProgram(program);

      if (program.program_start_date) {
        const startDate = new Date(program.program_start_date);
        const todayDate = new Date();
        const daysSinceStart = Math.floor(
          (todayDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const calculatedWeek = Math.floor(daysSinceStart / 7) + 1;

        if (calculatedWeek !== program.current_week) {
          await supabase
            .from("client_programs")
            .update({ current_week: calculatedWeek })
            .eq("id", program.id);

          program.current_week = calculatedWeek;
        }

        await checkMilestone(clientData.id, calculatedWeek);
      }

      const { data: daysData, error: daysError } = await supabase
        .from("client_program_days")
        .select("*")
        .eq("client_program_id", program.id)
        .order("sort_order", { ascending: true });

      if (!daysError && daysData && daysData.length > 0) {
        setProgramDays(daysData);
        const { data: completionData } = await supabase
          .from("client_workout_completions")
          .select("*")
          .eq("client_id", clientData.id)
          .eq("client_program_id", program.id);

        const completions = completionData ?? [];
        setWorkoutCompletions(completions);

        const nextWorkoutDay =
          getNextWorkoutDay(daysData, completions) ?? daysData[0];

        setCurrentDay(nextWorkoutDay);

        const { data: exerciseData, error: exerciseError } = await supabase
          .from("client_program_day_exercises")
          .select("id, client_program_day_id, sets")
          .eq("client_program_day_id", nextWorkoutDay.id)
          .order("sort_order", { ascending: true });

        if (!exerciseError && exerciseData) {
          setDayExercises(exerciseData);

          const exerciseIds = exerciseData.map((e) => e.id);

          if (exerciseIds.length > 0) {
const { data: setLogData, error: setLogError } = await supabase
  .from("client_program_set_logs")
  .select("id, client_program_day_exercise_id, completed")
  .eq("client_id", clientData.id)
  .eq("client_program_day_id", nextWorkoutDay.id)
  .eq("log_date", today)
  .in("client_program_day_exercise_id", exerciseIds)
  ;

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
        setProgramDays([]);
        setWorkoutCompletions([]);
        setDayExercises([]);
        setSetLogs([]);
      }
    } else {
      setCurrentDay(null);
      setProgramDays([]);
      setWorkoutCompletions([]);
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

    const { data: ptRequestData } = await supabase
      .from("pt_session_requests")
      .select("*")
      .eq("client_id", clientData.id)
      .order("created_at", { ascending: false })
      .limit(5);

    setPtRequests((ptRequestData ?? []) as PtSessionRequest[]);

    // --- Companion (only if feature enabled for this client) ---
    const isEnabled = await isCompanionEnabledForClient(clientData.id);
    setCompanionEnabled(isEnabled);

    if (isEnabled) {
      const cv = await getActiveCompanionView(clientData.id);
      setCompanionView(cv);
    } else {
      setCompanionView(null);
    }

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

  // Capture the previous step count before we update, so we can detect
  // whether this save crosses the target threshold for the first time today.
  const previousSteps = dailyTracking?.steps_logged ?? 0;
  const target = client.daily_step_target;
  const crossingTarget = previousSteps < target && steps >= target;

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

  // Award Bond XP only when the target is crossed for the first time today.
  if (crossingTarget) {
    await awardBondXp(
      client.id,
      COMPANION_XP_REWARDS.stepsTargetHit,
      "steps_target_hit",
      "Daily step target hit"
    );
  }

  setSavingSteps(false);
};

  const handleSubmitPtRequest = async () => {
    if (!client || !preferredPtDateTime) {
      alert("Please choose a preferred date and time.");
      return;
    }

    setSubmittingPtRequest(true);

    const { data, error } = await supabase
      .from("pt_session_requests")
      .insert({
        client_id: client.id,
        preferred_start_at: new Date(preferredPtDateTime).toISOString(),
        client_note: ptRequestNote.trim() || null,
      })
      .select()
      .single();

    if (error || !data) {
      alert("Could not send PT request. Please try again.");
      setSubmittingPtRequest(false);
      return;
    }

    setPtRequests((prev) => [data as PtSessionRequest, ...prev]);
    setPreferredPtDateTime("");
    setPtRequestNote("");
    setSubmittingPtRequest(false);
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

if (newWaterStatus) {
  await updateStreak(client.id, "water", today);

  // Award Bond XP â€” only fires on falseâ†’true transition (we're inside the
  // newWaterStatus block, so this is the moment of crossing). Self-disabling
  // if companions aren't enabled for this client.
  await awardBondXp(
    client.id,
    COMPANION_XP_REWARDS.waterTargetHit,
    "water_complete",
    "Daily water target hit"
  );
}

setTogglingWater(false);
  };

  const handleSubmitMilestone = async () => {
    if (!client || !clientMilestone || !milestoneConfig) return;

    if (milestoneConfig.requires_questionnaire) {
      const allAnswered = milestoneConfig.questionnaire_questions.every((_, index) => {
        return questionnaireAnswers[index] !== undefined && questionnaireAnswers[index] !== "";
      });

      if (!allAnswered) {
        alert("Please answer all questions");
        return;
      }
    }

    if (milestoneConfig.requires_photos && (!frontFile || !backFile || !sideFile)) {
      alert("Please upload all 3 photos (Front, Back, Side)");
      return;
    }

    setSubmittingMilestone(true);

    try {
      let photoLogDate = clientMilestone.photo_log_date;

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

          const { error: dbError } = await supabase.from("progress_photos").insert([
            {
              client_id: client.id,
              image_url: filePath,
              storage_path: filePath,
              log_date: photoLogDate,
              photo_type: type,
              note: `Week ${milestoneConfig.week_number} milestone`,
            },
          ]);

          if (dbError) throw dbError;
        }
      }

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

// Award Bond XP for completing the milestone. Self-disabling if companions
// aren't enabled. The milestone can only be completed once per week (the
// flag flip is idempotent), so no extra check needed for repeat awards.
await awardBondXp(
  client.id,
  COMPANION_XP_REWARDS.milestoneComplete,
  `milestone_week_${milestoneConfig.week_number}`,
  `Completed Week ${milestoneConfig.week_number} milestone`
);

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
useEffect(() => {
  const handleVisibility = () => {
    if (Date.now() - lastDashboardLoadAtRef.current < 3000) return;

    if (document.visibilityState === "visible") {
      loadDashboard();
    }
  };

  document.addEventListener("visibilitychange", handleVisibility);
  window.addEventListener("focus", handleVisibility);

  return () => {
    document.removeEventListener("visibilitychange", handleVisibility);
    window.removeEventListener("focus", handleVisibility);
  };
}, [today]);
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <>
      <div className="w-full max-w-full min-w-0 overflow-x-hidden">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className={styles.display}>Dashboard</h1>
          <button onClick={handleLogout} className={styles.buttonPrimary}>
            Logout
          </button>
        </div>

        {loading ? (
          <DashboardSkeleton />
        ) : !client ? (
          <p className={styles.body}>Client not found.</p>
        ) : (
          <div className="w-full min-w-0 space-y-4">
            <div className={`${styles.card} min-w-0`}>
              <h2 className={`break-words text-2xl font-semibold ${styles.goldText}`}>
                Welcome, {client.full_name}
              </h2>
              <p className={`mt-2 ${styles.body}`}>Here&apos;s your progress for today.</p>
              <div className="mt-4">
                <GuideLink guide="welcome" label="Watch Peter's welcome guide" />
              </div>

{(clientProgram?.current_week ?? 0) > 0 && (
                    <p className="mt-2 text-sm text-ink-muted">
You&apos;re currently in Week {clientProgram?.current_week}                </p>
              )}
            </div>

            <ClientUnreadRepliesBanner clientId={client.id} />

            <div className="grid w-full min-w-0 gap-4 md:grid-cols-2">
              <div className="min-w-0 rounded-lg bg-surface-sunken p-4 shadow-subtle sm:p-5">
                <Link href="/client/nutrition" className="block min-w-0">
                  <p className="text-sm text-ink-muted">Food Eaten Today</p>
                  <p className="mt-1 break-words text-lg font-semibold text-ink">
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
                    <p className="mt-2 text-sm text-ink-muted">
                      No calorie target set
                    </p>
                  )}
                </Link>

                <div className="mt-4 border-t border-border-subtle pt-4">
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-medium text-ink">Water (2L target)</p>

                    <button
                      onClick={handleToggleWater}
                      disabled={togglingWater}
                      className={`w-full sm:w-auto ${
                        dailyTracking?.water_completed
                          ? styles.buttonPrimaryNutrition
                          : styles.buttonSecondary
                      }`}
                    >
                      {togglingWater
                        ? "..."
                        : dailyTracking?.water_completed
                        ? "Complete"
                        : "Mark Complete"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="min-w-0 rounded-lg bg-surface-sunken p-4 shadow-subtle sm:p-5">
                <ThisWeekWorkouts
                  days={programDays}
                  completions={workoutCompletions.filter(
                    (completion) => completion.completed_date >= weekStart
                  )}
                  currentDayId={currentDay?.id ?? null}
                  weekStart={weekStart}
                  embedded
                />

                {programDays.length === 0 && (
                  <Link href="/client/workout" className="block min-w-0">
                    <p className="text-sm text-ink-muted">Workouts</p>
                    <p className="mt-1 break-words text-lg font-semibold text-ink">
                      No active programme day
                    </p>
                  </Link>
                )}

                {currentDay && (
                  <p className="mt-3 text-sm text-ink-muted">
                    {completedExercises} of {totalExercises} exercises complete for{" "}
                    {currentDay.day_name || "today's workout"}
                  </p>
                )}

                <div className="mt-4 border-t border-border-subtle pt-4">
                  <p className="text-sm font-medium text-ink">Today&apos;s Steps</p>

                  <div className="mt-2 flex w-full min-w-0 flex-wrap items-center gap-2">
                    <input
                      type="number"
                      value={stepsInput}
                      onChange={(e) => setStepsInput(e.target.value)}
                      placeholder="0"
                      className="min-w-0 flex-1 rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-ink"
                    />

                    <span className="shrink-0 text-sm text-ink-muted">
                      / {client.daily_step_target.toLocaleString()}
                    </span>

                    <button
                      onClick={handleSaveSteps}
                      disabled={savingSteps}
                      className={`${styles.buttonPrimaryWorkout} shrink-0`}
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
            </div>

            <Link
              href="/client/stats"
              className={`${styles.cardInteractive} block min-w-0 bg-surface-sunken`}
            >
              <p className="text-sm text-ink-muted">My Stats</p>
              <p className="mt-1 break-words text-lg font-semibold text-ink">
                {latestWeight
                  ? `Latest weight: ${latestWeight.weight_kg} kg`
                  : "Track weight, measurements and progress photos"}
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
                View graphs, measurements and photos
              </p>
            </Link>

            <div className={styles.card}>
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-gold/10 p-2 text-gold">
                  <CalendarClock size={20} />
                </div>
                <div>
                  <h2 className={styles.h2}>Request online PT</h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    Send Peter a preferred date and time. He can confirm it or
                    suggest an alternative.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] md:items-end">
                <div>
                  <label className="text-sm font-medium text-ink">
                    Preferred date and time
                  </label>
                  <input
                    type="datetime-local"
                    value={preferredPtDateTime}
                    onChange={(event) => setPreferredPtDateTime(event.target.value)}
                    className={styles.input}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-ink">
                    Notes
                  </label>
                  <input
                    value={ptRequestNote}
                    onChange={(event) => setPtRequestNote(event.target.value)}
                    className={styles.input}
                    placeholder="Anything Peter should know?"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSubmitPtRequest}
                  disabled={submittingPtRequest}
                  className={styles.buttonPrimary}
                >
                  {submittingPtRequest ? "Sending..." : "Send request"}
                </button>
              </div>

              {ptRequests.length > 0 && (
                <div className="mt-5 space-y-2">
                  <p className="text-sm font-semibold text-ink">Recent requests</p>
                  {ptRequests.map((request) => (
                    <div
                      key={request.id}
                      className="rounded-md border border-border-subtle bg-surface-sunken p-3"
                    >
                      <p className="text-sm font-medium text-ink">
                        Preferred: {formatSessionDateTime(request.preferred_start_at)}
                      </p>
                      <p className="mt-1 text-xs text-ink-muted">
                        Status: {request.status.replaceAll("_", " ")}
                      </p>
                      {request.status === "confirmed" && (
                        <p className="mt-1 text-sm text-emerald">
                          Confirmed for {formatSessionDateTime(request.confirmed_start_at)}
                        </p>
                      )}
                      {request.status === "alternative_suggested" && (
                        <p className="mt-1 text-sm text-gold">
                          Alternative suggested: {formatSessionDateTime(request.proposed_start_at)}
                        </p>
                      )}
                      {request.trainer_response && (
                        <p className="mt-1 text-sm text-ink-muted">
                          Peter: {request.trainer_response}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <MessageTrainerBox
              clientId={client.id}
              contextType="general"
              contextLabel="General check-in"
              title="Message Peter"
              placeholder="Ask Peter a question or leave him a quick update..."
              showRecentMessages={false}
            />

            {/* Companion widget â€” only renders if companion feature is enabled for this client */}
            {companionEnabled && (
              <Link
                href="/client/companion"
                className={`${styles.cardInteractive} block min-w-0 bg-surface-sunken`}
              >
                {companionView ? (
                  <div className="flex items-center gap-4">
                    {companionView.currentForm.image_url ? (
                      <img
                        src={companionView.currentForm.image_url}
                        alt={companionView.currentForm.name}
                        className="h-16 w-16 shrink-0 rounded-lg border border-border-subtle object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface text-2xl">
                        ?
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink-muted">Your Companion</p>
                      <p className="mt-1 break-words text-lg font-semibold text-ink">
                        {companionView.companion.custom_name ??
                          companionView.path.default_name ??
                          companionView.path.name}
                      </p>
                      <p className="mt-1 text-sm text-emerald">
                        {companionView.currentForm.name}
                      </p>

                      {companionView.nextForm ? (
                        <>
                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white">
                            <div
                              className="h-full rounded-full bg-emerald transition-all"
                              style={{ width: `${companionView.progressPct}%` }}
                            />
                          </div>
                          <p className="mt-2 text-xs text-ink-muted">
                            {companionView.xpToNextForm} XP to {companionView.nextForm.name}
                          </p>
                        </>
                      ) : (
                        <p className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald">
                          <Sparkles size={12} /> Mastered
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-ink-muted">Companion</p>
                    <p className="mt-1 break-words text-lg font-semibold text-ink">
                      Choose a companion to start your journey
                    </p>
                    <p className="mt-2 text-sm text-ink-muted">
                      A small sidekick that grows alongside you
                    </p>
                  </>
                )}
              </Link>
            )}

            <WeeklyCheckInCard
              clientId={client.id}
              weekStart={weekStart}
              onboardingCompletedAt={
                client.onboarding_completed_at ?? client.created_at ?? null
              }
              presentation={today === weekStart ? "modal" : "card"}
            />

            {/* StreakDisplay hidden for launch â€” kept rendered=false so the underlying
                streak mechanic still records data in the background. Re-enable by
                uncommenting the import and the line below. */}
            {/* <div className="min-w-0">
              <StreakDisplay clientId={client.id} />
            </div> */}

            {/* Leaderboard removed for launch â€” competitive mechanics deferred.
                Component file remains in /components for future use. */}
          </div>
        )}
      </div>

      {showMilestoneModal && milestoneConfig && clientMilestone && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div
            className={`${styles.card} max-h-[90vh] w-full max-w-2xl overflow-y-auto`}
          >
            <div>
              <h2 className={styles.h2}>
                Week {milestoneConfig.week_number} Milestone
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                Complete this milestone to continue your program
              </p>
            </div>

            <div className="mt-4 flex items-start gap-3 rounded-md border border-emerald/20 bg-emerald/5 p-3">
              {companionView?.currentForm.image_url ? (
                <img
                  src={companionView.currentForm.image_url}
                  alt={companionView.currentForm.name}
                  className="h-10 w-10 shrink-0 rounded-md border border-emerald/30 object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-emerald/30 bg-surface-raised text-xs font-semibold text-emerald">
                  PT
                </div>
              )}

              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">
                  {companionDisplayName
                    ? `${companionDisplayName}'s milestone note`
                    : "Milestone note"}
                </p>
                <p className="mt-1 text-sm text-ink-muted">
                  This gives Peter a clearer picture of how your programme is landing.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-6">
              {milestoneConfig.requires_questionnaire && (
                <div>
                  <h3 className="mb-3 font-semibold text-ink">Questionnaire</h3>

                  <div className="space-y-4">
                    {milestoneConfig.questionnaire_questions.map((q, index) => (
                      <div key={index} className="min-w-0">
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
                            className={`${styles.input} mt-2 w-full min-w-0`}
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
                            className={`${styles.input} mt-2 w-full min-w-0`}
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
                                  className="h-4 w-4 shrink-0"
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

              {milestoneConfig.requires_photos && (
                <div>
                  <h3 className="mb-3 font-semibold text-ink">Progress Photos</h3>
                  <p className="mb-3 text-sm text-ink-muted">
                    Upload Front, Back and Side photos
                  </p>

                  <div className="grid min-w-0 gap-3 md:grid-cols-3">
                    <div className="min-w-0">
                      <label className="text-sm font-medium text-ink">
                        Front Photo
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setFrontFile(e.target.files?.[0] || null)}
                        className={`${styles.input} w-full min-w-0 pt-2`}
                      />
                    </div>

                    <div className="min-w-0">
                      <label className="text-sm font-medium text-ink">
                        Back Photo
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setBackFile(e.target.files?.[0] || null)}
                        className={`${styles.input} w-full min-w-0 pt-2`}
                      />
                    </div>

                    <div className="min-w-0">
                      <label className="text-sm font-medium text-ink">
                        Side Photo
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setSideFile(e.target.files?.[0] || null)}
                        className={`${styles.input} w-full min-w-0 pt-2`}
                      />
                    </div>
                  </div>
                </div>
              )}

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
      {showTour && client && (
  <TourModal
    clientId={client.id}
    onComplete={() => {
      setShowTour(false);
      setClient({ ...client, tour_completed_at: new Date().toISOString() });
    }}
  />
)}
    </>
  );
}


