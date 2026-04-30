"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";

type Client = {
  id: string;
  full_name: string;
  profile_id: string | null;
};

type ClientProgram = {
  id: string;
  client_id: string;
  program_template_id: string | null;
  current_day_index: number | null;
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

type Exercise = {
  id: string;
  name: string;
  youtube_short: string | null;
  rest: number | null;
  target_muscle: string | null;
  movement_type: string | null;
  primary_equipment: string | null;
  alternate: string | null;
};

type ClientProgramDayExercise = {
  id: string;
  client_program_day_id: string;
  exercise_name: string | null;
  sets: number | null;
  reps: string | null;
  target_weight_kg: number | null;
  sort_order: number | null;
  exercise_details?: Exercise | null;
};

type ClientProgramSetLog = {
  id: string;
  client_program_day_exercise_id: string;
  set_number: number;
  actual_weight_kg: number | null;
  actual_reps: number | null;
  completed: boolean;
};

type DraftValues = {
  weight: string;
  reps: string;
};

type PreviousWeightMap = Record<string, number | null>;

type RestTimer = {
  exerciseId: string;
  setNumber: number;
  secondsRemaining: number;
  totalSeconds: number;
};

export default function ClientWorkoutPage() {
  const [client, setClient] = useState<Client | null>(null);
  const [clientProgram, setClientProgram] = useState<ClientProgram | null>(null);
  const [programDays, setProgramDays] = useState<ClientProgramDay[]>([]);
  const [selectedDayId, setSelectedDayId] = useState("");
  const [currentDay, setCurrentDay] = useState<ClientProgramDay | null>(null);
  const [dayExercises, setDayExercises] = useState<ClientProgramDayExercise[]>([]);
  const [activeExerciseId, setActiveExerciseId] = useState("");
  const [setLogs, setSetLogs] = useState<ClientProgramSetLog[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftValues>>({});
  const [previousWeights, setPreviousWeights] = useState<PreviousWeightMap>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [completingDay, setCompletingDay] = useState(false);
  const [debugMessage, setDebugMessage] = useState("");
  const [restTimer, setRestTimer] = useState<RestTimer | null>(null);
  const [showVideo, setShowVideo] = useState(false);

  // Rest timer countdown
  useEffect(() => {
    if (!restTimer) return;

    if (restTimer.secondsRemaining <= 0) {
      setRestTimer(null);
      return;
    }

    const interval = setInterval(() => {
      setRestTimer((prev) => {
        if (!prev || prev.secondsRemaining <= 1) return null;
        return {
          ...prev,
          secondsRemaining: prev.secondsRemaining - 1,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [restTimer]);

  useEffect(() => {
    const loadWorkout = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setDebugMessage("No logged-in auth user found.");
        setLoading(false);
        return;
      }

      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("id, full_name, profile_id")
        .eq("profile_id", user.id)
        .single();

      if (clientError || !clientData) {
        setDebugMessage(`No client row matches logged-in user id: ${user.id}`);
        setLoading(false);
        return;
      }

      setClient(clientData);

      const { data: clientProgramData, error: clientProgramError } = await supabase
        .from("client_programs")
        .select("*")
        .eq("client_id", clientData.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (clientProgramError || !clientProgramData || clientProgramData.length === 0) {
        setDebugMessage("No client programme found for this client.");
        setLoading(false);
        return;
      }

      const program = clientProgramData[0];
      setClientProgram(program);

      const { data: daysData, error: daysError } = await supabase
        .from("client_program_days")
        .select("*")
        .eq("client_program_id", program.id)
        .order("sort_order", { ascending: true });

      if (daysError || !daysData || daysData.length === 0) {
        setDebugMessage("No programme days found for this client.");
        setLoading(false);
        return;
      }

      setProgramDays(daysData);

      const firstIncompleteDay =
        daysData.find((day) => !day.completed) ?? daysData[0];

      setSelectedDayId(firstIncompleteDay.id);
      setLoading(false);
    };

    loadWorkout();
  }, []);

  useEffect(() => {
    const loadSelectedDay = async () => {
      if (!client || !clientProgram || !selectedDayId) return;

      const selectedDay = programDays.find((day) => day.id === selectedDayId) || null;
      setCurrentDay(selectedDay);
      setDrafts({});
      setPreviousWeights({});
      setShowVideo(false);

      if (!selectedDay) {
        setDayExercises([]);
        setSetLogs([]);
        return;
      }

      const { data: exerciseData, error: exerciseError } = await supabase
        .from("client_program_day_exercises")
        .select("*")
        .eq("client_program_day_id", selectedDay.id)
        .order("sort_order", { ascending: true });

      if (exerciseError) {
        setDebugMessage("Error loading programme day exercises.");
        setDayExercises([]);
        setSetLogs([]);
        return;
      }

      if (!exerciseData || exerciseData.length === 0) {
        setDayExercises([]);
        setSetLogs([]);
        return;
      }

      // Load exercise details from exercises table
      const exerciseNames = exerciseData
        .map((e) => e.exercise_name)
        .filter(Boolean) as string[];

      let exerciseDetailsMap: Record<string, Exercise> = {};

      if (exerciseNames.length > 0) {
        const { data: exerciseDetails } = await supabase
          .from("exercises")
          .select("*")
          .in("name", exerciseNames);

        if (exerciseDetails) {
          exerciseDetailsMap = Object.fromEntries(
            exerciseDetails.map((ex) => [ex.name, ex])
          );
        }
      }

      // Attach exercise details to each day exercise
      const enrichedExercises = exerciseData.map((ex) => ({
        ...ex,
        exercise_details: ex.exercise_name
          ? exerciseDetailsMap[ex.exercise_name] || null
          : null,
      }));

      setDayExercises(enrichedExercises);
      setActiveExerciseId(enrichedExercises[0]?.id ?? "");
      const exerciseIds = enrichedExercises.map((e) => e.id);

      if (exerciseIds.length > 0) {
        const { data: setLogData, error: setLogError } = await supabase
          .from("client_program_set_logs")
          .select("*")
          .eq("client_id", client.id)
          .eq("client_program_id", clientProgram.id)
          .eq("client_program_day_id", selectedDay.id)
          .in("client_program_day_exercise_id", exerciseIds);

        if (!setLogError && setLogData) {
          setSetLogs(setLogData);
        } else {
          setSetLogs([]);
        }
      } else {
        setSetLogs([]);
      }

      const exerciseNamesForPrevious = Array.from(
        new Set(
          enrichedExercises
            .map((exercise) => exercise.exercise_name?.trim())
            .filter(Boolean)
        )
      ) as string[];

      if (exerciseNamesForPrevious.length > 0) {
        const previousWeightLookup: Record<string, number | null> = {};

        for (const exerciseName of exerciseNamesForPrevious) {
          const { data: matchingExercises } = await supabase
            .from("client_program_day_exercises")
            .select("id")
            .eq("exercise_name", exerciseName);

          const matchingExerciseIds =
            matchingExercises?.map((exercise) => exercise.id) ?? [];

          if (matchingExerciseIds.length === 0) {
            previousWeightLookup[exerciseName] = null;
            continue;
          }

          const { data: previousLogs } = await supabase
            .from("client_program_set_logs")
            .select("actual_weight_kg")
            .eq("client_id", client.id)
            .in("client_program_day_exercise_id", matchingExerciseIds)
            .not("actual_weight_kg", "is", null)
            .order("created_at", { ascending: false })
            .limit(1);

          previousWeightLookup[exerciseName] =
            previousLogs && previousLogs.length > 0
              ? previousLogs[0].actual_weight_kg
              : null;
        }

        setPreviousWeights(previousWeightLookup);
      }
    };

    loadSelectedDay();
  }, [selectedDayId, client, clientProgram, programDays]);

  const getSetLog = (exerciseId: string, setNumber: number) =>
    setLogs.find(
      (log) =>
        log.client_program_day_exercise_id === exerciseId &&
        log.set_number === setNumber
    ) || null;

  const getDraftKey = (exerciseId: string, setNumber: number) =>
    `${exerciseId}-${setNumber}`;

  const getDefaultReps = (exercise: ClientProgramDayExercise) => {
    if (!exercise.reps) return "";
    return /^\d+$/.test(exercise.reps.trim()) ? exercise.reps.trim() : "";
  };

  const getRememberedWeight = (exercise: ClientProgramDayExercise) => {
    if (!exercise.exercise_name) return "";
    const previousWeight = previousWeights[exercise.exercise_name];
    if (previousWeight !== null && previousWeight !== undefined) {
      return String(previousWeight);
    }
    return "";
  };

  const getDisplayWeight = (exercise: ClientProgramDayExercise, setNumber: number) => {
    const key = getDraftKey(exercise.id, setNumber);
    if (drafts[key]?.weight !== undefined) return drafts[key].weight;

    const setLog = getSetLog(exercise.id, setNumber);
    if (setLog?.actual_weight_kg !== null && setLog?.actual_weight_kg !== undefined) {
      return String(setLog.actual_weight_kg);
    }

    const rememberedWeight = getRememberedWeight(exercise);
    if (rememberedWeight !== "") return rememberedWeight;

    if (exercise.target_weight_kg !== null && exercise.target_weight_kg !== undefined) {
      return String(exercise.target_weight_kg);
    }

    return "";
  };

  const getDisplayReps = (exercise: ClientProgramDayExercise, setNumber: number) => {
    const key = getDraftKey(exercise.id, setNumber);
    if (drafts[key]?.reps !== undefined) return drafts[key].reps;

    const setLog = getSetLog(exercise.id, setNumber);
    if (setLog?.actual_reps !== null && setLog?.actual_reps !== undefined) {
      return String(setLog.actual_reps);
    }

    return getDefaultReps(exercise);
  };

  const completedExerciseCount = useMemo(() => {
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
  const completionPercentage =
    totalExercises > 0
      ? Math.round((completedExerciseCount / totalExercises) * 100)
      : 0;

  const activeExercise =
    dayExercises.find((exercise) => exercise.id === activeExerciseId) ??
    dayExercises[0] ??
    null;

  const upsertSetLog = async ({
    clientId,
    clientProgramId,
    clientProgramDayId,
    exerciseId,
    setNumber,
    updates,
  }: {
    clientId: string;
    clientProgramId: string;
    clientProgramDayId: string;
    exerciseId: string;
    setNumber: number;
    updates: {
      actual_weight_kg?: number | null;
      actual_reps?: number | null;
      completed?: boolean;
    };
  }) => {
    const key = getDraftKey(exerciseId, setNumber);
    setSavingKey(key);

    const existing = getSetLog(exerciseId, setNumber);

    // FIRST WORKOUT TRIGGER: Check if program needs to be started
    if (!existing && clientProgram?.program_start_date === null) {
      const today = new Date().toISOString().split("T")[0];
      
      await supabase
        .from("client_programs")
        .update({
          program_start_date: today,
          current_week: 1,
        })
        .eq("id", clientProgramId);

      // Update local state
      setClientProgram((prev) =>
        prev
          ? {
              ...prev,
              program_start_date: today,
              current_week: 1,
            }
          : null
      );
    }

    if (existing) {
      const { data, error } = await supabase
        .from("client_program_set_logs")
        .update(updates)
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        alert("Error saving set");
        setSavingKey(null);
        return;
      }

      setSetLogs((prev) =>
        prev.map((log) => (log.id === existing.id ? data : log))
      );
    } else {
      const { data, error } = await supabase
        .from("client_program_set_logs")
        .insert([
          {
            client_id: clientId,
            client_program_id: clientProgramId,
            client_program_day_id: clientProgramDayId,
            client_program_day_exercise_id: exerciseId,
            set_number: setNumber,
            actual_weight_kg: updates.actual_weight_kg ?? null,
            actual_reps: updates.actual_reps ?? null,
            completed: updates.completed ?? false,
          },
        ])
        .select()
        .single();

      if (error) {
        alert("Error saving set");
        setSavingKey(null);
        return;
      }

      setSetLogs((prev) => [...prev, data]);
    }

    setSavingKey(null);
  };

  const handleToggleSet = async (
    exercise: ClientProgramDayExercise,
    setNumber: number,
    checked: boolean
  ) => {
    if (!client || !clientProgram || !currentDay) return;

    const weightValue = getDisplayWeight(exercise, setNumber);
    const repsValue = getDisplayReps(exercise, setNumber);

    await upsertSetLog({
      clientId: client.id,
      clientProgramId: clientProgram.id,
      clientProgramDayId: currentDay.id,
      exerciseId: exercise.id,
      setNumber,
      updates: {
        completed: checked,
        actual_weight_kg: weightValue === "" ? null : Number(weightValue),
        actual_reps: repsValue === "" ? null : Number(repsValue),
      },
    });

    // Start rest timer if completing the set
    if (checked && exercise.exercise_details?.rest) {
      setRestTimer({
        exerciseId: exercise.id,
        setNumber,
        secondsRemaining: exercise.exercise_details.rest,
        totalSeconds: exercise.exercise_details.rest,
      });
    }
  };

  const handleWeightChange = (exerciseId: string, setNumber: number, value: string) => {
    const key = getDraftKey(exerciseId, setNumber);
    setDrafts((prev) => ({
      ...prev,
      [key]: {
        weight: value,
        reps: prev[key]?.reps ?? "",
      },
    }));
  };

  const handleRepsChange = (exerciseId: string, setNumber: number, value: string) => {
    const key = getDraftKey(exerciseId, setNumber);
    setDrafts((prev) => ({
      ...prev,
      [key]: {
        weight: prev[key]?.weight ?? "",
        reps: value,
      },
    }));
  };

  const handleWeightBlur = async (exercise: ClientProgramDayExercise, setNumber: number) => {
    if (!client || !clientProgram || !currentDay) return;

    const setLog = getSetLog(exercise.id, setNumber);
    const weightValue = getDisplayWeight(exercise, setNumber);
    const repsValue = getDisplayReps(exercise, setNumber);

    await upsertSetLog({
      clientId: client.id,
      clientProgramId: clientProgram.id,
      clientProgramDayId: currentDay.id,
      exerciseId: exercise.id,
      setNumber,
      updates: {
        completed: setLog?.completed ?? false,
        actual_weight_kg: weightValue === "" ? null : Number(weightValue),
        actual_reps: repsValue === "" ? null : Number(repsValue),
      },
    });
  };

  const handleRepsBlur = async (exercise: ClientProgramDayExercise, setNumber: number) => {
    if (!client || !clientProgram || !currentDay) return;

    const setLog = getSetLog(exercise.id, setNumber);
    const weightValue = getDisplayWeight(exercise, setNumber);
    const repsValue = getDisplayReps(exercise, setNumber);

    await upsertSetLog({
      clientId: client.id,
      clientProgramId: clientProgram.id,
      clientProgramDayId: currentDay.id,
      exerciseId: exercise.id,
      setNumber,
      updates: {
        completed: setLog?.completed ?? false,
        actual_weight_kg: weightValue === "" ? null : Number(weightValue),
        actual_reps: repsValue === "" ? null : Number(repsValue),
      },
    });
  };

  const handleCompleteDay = async () => {
    if (!currentDay) return;

    setCompletingDay(true);

    const { error } = await supabase
      .from("client_program_days")
      .update({ completed: true })
      .eq("id", currentDay.id);

    if (error) {
      alert("Error completing day");
      setCompletingDay(false);
      return;
    }

    const updatedDays = programDays.map((day) =>
      day.id === currentDay.id ? { ...day, completed: true } : day
    );
    setProgramDays(updatedDays);

    const nextDay = updatedDays.find((day) => !day.completed);
    if (nextDay) {
      setSelectedDayId(nextDay.id);
    } else {
      setCurrentDay(null);
      setDayExercises([]);
      setSetLogs([]);
    }

    setDrafts({});
    setPreviousWeights({});
    setCompletingDay(false);
    alert("Workout day completed!");
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getYouTubeEmbedUrl = (url: string | null) => {
    if (!url) return null;
    
    // Extract video ID from various YouTube URL formats
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\?\/]+)/,
      /youtube\.com\/shorts\/([^&\?\/]+)/,
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return `https://www.youtube.com/embed/${match[1]}`;
      }
    }
    
    return null;
  };

  return (
    <>
      <h1 className={styles.display}>Workout</h1>

      {/* Rest Timer Banner */}
      {restTimer && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-workout px-4 py-3 text-white shadow-lg">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div>
              <p className="text-sm font-medium">Rest Timer</p>
              <p className="text-xs opacity-90">
                Set {restTimer.setNumber} complete
              </p>
            </div>
            <div className="flex items-center gap-4">
              <p className="text-2xl font-bold tabular-nums">
                {formatTime(restTimer.secondsRemaining)}
              </p>
              <button
                onClick={() => setRestTimer(null)}
                className="rounded-lg bg-white/20 px-3 py-1 text-sm font-medium hover:bg-white/30"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className={styles.body}>Loading workout...</p>
      ) : !client ? (
        <p className={styles.body}>{debugMessage || "Client not found."}</p>
      ) : !clientProgram || !currentDay ? (
        <p className={styles.body}>
          {debugMessage || "No active programme day available yet."}
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          <div className={styles.card}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h2 className={styles.h2}>
                  {currentDay.day_name || "Workout Day"}
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Current selected day
                </p>
                {clientProgram.current_week > 0 && (
                  <p className="mt-1 text-xs text-ink-muted">
                    Week {clientProgram.current_week}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-ink">
                  Change workout day
                </label>
                <select
                  value={selectedDayId}
                  onChange={(e) => setSelectedDayId(e.target.value)}
                  className={styles.input}
                >
                  {programDays.map((day) => (
                    <option key={day.id} value={day.id}>
                      {day.day_name || "Workout Day"}
                      {day.completed ? " ✓" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-ink">
                {completedExerciseCount} of {totalExercises} exercises complete
              </span>
              <span className="text-sm text-ink-muted">
                {completionPercentage}% completed
              </span>
            </div>

            <div className="mt-3">
              <div className="h-3 w-full rounded-full bg-surface-sunken">
                <div
                  className="h-full rounded-full bg-workout transition-all"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {dayExercises.length > 0 && activeExercise ? (
              <>
                <div className="flex gap-2 overflow-x-auto rounded-2xl bg-surface-sunken p-2">
                  {dayExercises.map((exercise, index) => {
                    const isActive = exercise.id === activeExercise.id;

                    return (
                      <button
                        key={exercise.id}
                        type="button"
                        onClick={() => {
                          setActiveExerciseId(exercise.id);
                          setShowVideo(false);
                        }}
                        className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition ${
                          isActive
                            ? styles.buttonPrimaryWorkout
                            : "border border-slate-200 bg-white text-ink hover:bg-surface"
                        }`}
                      >
                        {exercise.exercise_name || `Exercise ${index + 1}`}
                      </button>
                    );
                  })}
                </div>

                <div className={styles.card}>
                  <p className="font-semibold text-ink">
                    {activeExercise.exercise_name}
                  </p>

                  <p className="text-sm text-ink-muted">
                    Target: {activeExercise.sets ?? "-"} sets ×{" "}
                    {activeExercise.reps ?? "-"} reps
                    {activeExercise.target_weight_kg !== null
                      ? ` × ${activeExercise.target_weight_kg}kg`
                      : ""}
                  </p>

                  {/* Exercise Details */}
                  {activeExercise.exercise_details && (
                    <div className="mt-3 grid gap-2 rounded-xl bg-surface-sunken p-3 text-sm md:grid-cols-3">
                      {activeExercise.exercise_details.primary_equipment && (
                        <div>
                          <p className="font-medium text-ink">Equipment</p>
                          <p className="text-ink-muted">
                            {activeExercise.exercise_details.primary_equipment}
                          </p>
                        </div>
                      )}
                      {activeExercise.exercise_details.target_muscle && (
                        <div>
                          <p className="font-medium text-ink">Target Muscle</p>
                          <p className="text-ink-muted">
                            {activeExercise.exercise_details.target_muscle}
                          </p>
                        </div>
                      )}
                      {activeExercise.exercise_details.movement_type && (
                        <div>
                          <p className="font-medium text-ink">Movement Type</p>
                          <p className="text-ink-muted">
                            {activeExercise.exercise_details.movement_type}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-4 space-y-3">
                    {(activeExercise.sets && activeExercise.sets > 0
                      ? Array.from({ length: activeExercise.sets }, (_, i) => i + 1)
                      : [1]
                    ).map((setNumber) => {
                      const setLog = getSetLog(activeExercise.id, setNumber);
                      const currentKey = getDraftKey(activeExercise.id, setNumber);

                      const rememberedWeight =
                        activeExercise.exercise_name &&
                        previousWeights[activeExercise.exercise_name] !== null &&
                        previousWeights[activeExercise.exercise_name] !== undefined
                          ? previousWeights[activeExercise.exercise_name]
                          : null;

                      return (
                        <div
                          key={setNumber}
                          className="grid gap-3 rounded-xl bg-surface-sunken p-3 md:grid-cols-12"
                        >
                          <div className="flex items-center md:col-span-2">
                            <p className="text-sm font-medium text-ink">
                              Set {setNumber}
                            </p>
                          </div>

                          <div className="md:col-span-4">
                            <label className="text-sm font-medium text-ink">
                              Weight (kg)
                            </label>
                            <input
                              type="number"
                              step="0.5"
                              value={getDisplayWeight(activeExercise, setNumber)}
                              onChange={(e) =>
                                handleWeightChange(
                                  activeExercise.id,
                                  setNumber,
                                  e.target.value
                                )
                              }
                              onBlur={() =>
                                handleWeightBlur(activeExercise, setNumber)
                              }
                              className={styles.input}
                              placeholder="Weight"
                            />
                            {rememberedWeight !== null && (
                              <p className="mt-1 text-xs text-ink-muted">
                                Previous weight: {rememberedWeight} kg
                              </p>
                            )}
                          </div>

                          <div className="md:col-span-4">
                            <label className="text-sm font-medium text-ink">
                              Reps completed
                            </label>
                            <input
                              type="number"
                              value={getDisplayReps(activeExercise, setNumber)}
                              onChange={(e) =>
                                handleRepsChange(
                                  activeExercise.id,
                                  setNumber,
                                  e.target.value
                                )
                              }
                              onBlur={() =>
                                handleRepsBlur(activeExercise, setNumber)
                              }
                              className={styles.input}
                              placeholder="Reps"
                            />
                          </div>

                          <div className="flex items-end justify-end md:col-span-2">
                            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-ink">
                              Completed
                              <input
                                type="checkbox"
                                checked={setLog?.completed ?? false}
                                onChange={(e) =>
                                  handleToggleSet(
                                    activeExercise,
                                    setNumber,
                                    e.target.checked
                                  )
                                }
                                disabled={savingKey === currentKey}
                              />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* YouTube Video Section */}
                  {activeExercise.exercise_details?.youtube_short && (
                    <div className="mt-4">
                      {!showVideo ? (
                        <button
                          onClick={() => setShowVideo(true)}
                          className={`${styles.buttonSecondary} w-full`}
                        >
                          Watch Exercise Video
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-ink">
                              Exercise Video
                            </p>
                            <button
                              onClick={() => setShowVideo(false)}
                              className="text-sm text-ink-muted hover:text-ink"
                            >
                              Hide
                            </button>
                          </div>
                          <div className="relative overflow-hidden rounded-xl" style={{ paddingBottom: "56.25%" }}>
                            <iframe
                              src={getYouTubeEmbedUrl(
                                activeExercise.exercise_details.youtube_short
                              ) || ""}
                              className="absolute inset-0 h-full w-full"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className={styles.body}>
                {debugMessage || "No exercises assigned for this day yet."}
              </p>
            )}
          </div>

          <button
            onClick={handleCompleteDay}
            disabled={completingDay}
            className={`${styles.buttonPrimaryWorkout} w-full py-3 disabled:opacity-50`}
          >
            {completingDay ? "Completing..." : "Complete Workout Day"}
          </button>
        </div>
      )}
    </>
  );
}