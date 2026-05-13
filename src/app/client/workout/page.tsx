"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";
import { getMondayOf, parseLocalDate, todayStr } from "@/lib/dates";
import { updateStreak } from "@/lib/streaks";
import {
  isCompanionEnabledForClient,
  getActiveCompanionView,
  getRandomLine,
  personalizeCompanionLine,
  type ActiveCompanionView,
} from "@/lib/companions";
import AchievementCelebration from "@/components/AchievementCelebration";
import AlternativeExerciseModal from "@/components/AlternativeExerciseModal";
import MessageTrainerBox from "@/components/MessageTrainerBox";
import ClientUnreadRepliesBanner from "@/components/ClientUnreadRepliesBanner";
import ThisWeekWorkouts from "@/components/ThisWeekWorkouts";
import GuideLink from "@/components/GuideLink";
import { RefreshCw, Plus, Undo2, CheckCircle2, XCircle } from "lucide-react";
import {
  createOfflineId,
  getOfflineWorkoutQueueCount,
  queueOfflineWorkoutItem,
  removeQueuedCompletion,
  syncOfflineWorkoutQueue,
} from "@/lib/offlineWorkoutQueue";

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

type ClientWorkoutCompletion = {
  id: string;
  client_id: string;
  client_program_id: string;
  client_program_day_id: string;
  completed_date: string;
  completed_at: string | null;
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
  alternative_exercises: string[] | null;
};

type ClientProgramDayExercise = {
  id: string;
  client_program_day_id: string;
  exercise_id: string | null;
  exercise_name: string | null;
  sets: number | null;
  reps: string | null;
  target_weight_kg: number | null;
  sort_order: number | null;
  original_exercise_id: string | null;
  is_custom: boolean;
  exercise_details?: Exercise | null;
};

type ClientProgramSetLog = {
  id: string;
  client_program_day_exercise_id: string;
  set_number: number;
  actual_weight_kg: number | null;
  actual_reps: number | null;
  completed: boolean;
  log_date: string | null;
};

type DraftValues = {
  weight: string;
  reps: string;
};

type PreviousWeightMap = Record<string, number | null>;

type ExerciseProgressionSuggestion = {
  lastWeight: number;
  suggestedWeight: number;
  sessionsAtWeight: number;
};

type ProgressionSuggestionMap = Record<string, ExerciseProgressionSuggestion | null>;

type RestTimer = {
  exerciseId: string;
  setNumber: number;
  secondsRemaining: number;
  totalSeconds: number;
};

type CelebrationAchievement = {
  icon: string;
  title: string;
  description: string;
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

export default function ClientWorkoutPage() {
  const [client, setClient] = useState<Client | null>(null);
  const [clientProgram, setClientProgram] = useState<ClientProgram | null>(null);
  const [programDays, setProgramDays] = useState<ClientProgramDay[]>([]);
  const [workoutCompletions, setWorkoutCompletions] = useState<ClientWorkoutCompletion[]>([]);
  const [selectedDayId, setSelectedDayId] = useState("");
  const [currentDay, setCurrentDay] = useState<ClientProgramDay | null>(null);
  const [dayExercises, setDayExercises] = useState<ClientProgramDayExercise[]>([]);
  const [activeExerciseId, setActiveExerciseId] = useState("");
  const [setLogs, setSetLogs] = useState<ClientProgramSetLog[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftValues>>({});
  const [previousWeights, setPreviousWeights] = useState<PreviousWeightMap>({});
  const [progressionSuggestions, setProgressionSuggestions] = useState<ProgressionSuggestionMap>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [completingDay, setCompletingDay] = useState(false);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [syncingOfflineQueue, setSyncingOfflineQueue] = useState(false);
  const [isBrowserOffline, setIsBrowserOffline] = useState(false);
  const [debugMessage, setDebugMessage] = useState("");
  const [restTimer, setRestTimer] = useState<RestTimer | null>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [celebrationAchievement, setCelebrationAchievement] =
    useState<CelebrationAchievement | null>(null);
  const [alternativeModalExercise, setAlternativeModalExercise] = useState<{
    exercise: any;
    clientProgramDayExerciseId: string;
  } | null>(null);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [addingExercise, setAddingExercise] = useState(false);
  const [swappingBack, setSwappingBack] = useState<string | null>(null);

  // Companion state — flag-gated, only populated if enabled.
  const [companionEnabled, setCompanionEnabled] = useState(false);
  const [companionView, setCompanionView] = useState<ActiveCompanionView | null>(null);
  const [restCount, setRestCount] = useState(0);
  const [companionLine, setCompanionLine] = useState<string | null>(null);
  const lastLineRef = useRef<string | null>(null);

  const today = useMemo(() => todayStr(), []);
  const weekStart = useMemo(() => getMondayOf(today), [today]);

  const refreshOfflineQueueCount = () => {
    setOfflineQueueCount(getOfflineWorkoutQueueCount());
  };

  const queueCreatedAt = () => new Date().toISOString();

  const canTryNetworkWrite = () =>
    typeof navigator === "undefined" || navigator.onLine;

  const syncQueuedWorkoutChanges = async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    setSyncingOfflineQueue(true);
    try {
      const result = await syncOfflineWorkoutQueue(supabase);
      refreshOfflineQueueCount();
      if (result.synced > 0) {
        await loadWorkout();
      }
    } finally {
      setSyncingOfflineQueue(false);
    }
  };

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
      setDebugMessage("Client account not found.");
      setLoading(false);
      return;
    }

    setClient(clientData);

    // Companion (only if enabled for this client) — runs in parallel with program load below.
    const isEnabled = await isCompanionEnabledForClient(clientData.id);
    setCompanionEnabled(isEnabled);

    if (isEnabled) {
      const cv = await getActiveCompanionView(clientData.id);
      setCompanionView(cv);
    }

    const { data: clientProgramData, error: clientProgramError } =
      await supabase
        .from("client_programs")
        .select("*")
        .eq("client_id", clientData.id)
        .order("created_at", { ascending: false })
        .limit(1);

    if (
      clientProgramError ||
      !clientProgramData ||
      clientProgramData.length === 0
    ) {
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

    const { data: completionData, error: completionError } = await supabase
      .from("client_workout_completions")
      .select("*")
      .eq("client_id", clientData.id)
      .eq("client_program_id", program.id);

    if (completionError) {
      setDebugMessage(
        "Workout completion history is not available. Please run the workout completion database migration."
      );
      setLoading(false);
      return;
    }

    const completions = completionData ?? [];
    setWorkoutCompletions(completions);

    const nextWorkoutDay = getNextWorkoutDay(daysData, completions);
    setSelectedDayId(nextWorkoutDay?.id ?? daysData[0].id);
    setLoading(false);
  };

  useEffect(() => {
    loadWorkout();
  }, []);

  useEffect(() => {
    const updateOnlineState = () => {
      setIsBrowserOffline(!navigator.onLine);
      refreshOfflineQueueCount();
    };

    updateOnlineState();

    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);
    window.addEventListener(
      "pt-offline-workout-queue-changed",
      refreshOfflineQueueCount
    );

    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
      window.removeEventListener(
        "pt-offline-workout-queue-changed",
        refreshOfflineQueueCount
      );
    };
  }, []);

  useEffect(() => {
    if (!isBrowserOffline && offlineQueueCount > 0) {
      syncQueuedWorkoutChanges();
    }
  }, [isBrowserOffline, offlineQueueCount]);

  useEffect(() => {
    const loadSelectedDay = async () => {
      if (!client || !clientProgram || !selectedDayId) return;

      const selectedDay =
        programDays.find((day) => day.id === selectedDayId) || null;

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

      // Get all exercise IDs and names so older rows without exercise_id still
      // receive video/rest/alternative data from the exercises table.
      const exerciseIds = exerciseData
        .map((e) => e.exercise_id)
        .filter(Boolean) as string[];
      const originalExerciseIds = exerciseData
        .map((e) => e.original_exercise_id)
        .filter(Boolean) as string[];
      const allExerciseIds = [...new Set([...exerciseIds, ...originalExerciseIds])];
      const exerciseNames = Array.from(
        new Set(
          exerciseData
            .map((e) => e.exercise_name?.trim())
            .filter(Boolean)
        )
      ) as string[];

      let exerciseDetailsMap: Record<string, Exercise> = {};
      let exerciseDetailsNameMap: Record<string, Exercise> = {};

      if (allExerciseIds.length > 0) {
        const { data: exerciseDetails } = await supabase
          .from("exercises")
          .select("*")
          .in("id", allExerciseIds);

        if (exerciseDetails) {
          exerciseDetailsMap = Object.fromEntries(
            exerciseDetails.map((ex) => [ex.id, ex])
          );
        }
      }

      if (exerciseNames.length > 0) {
        const { data: exerciseDetailsByName } = await supabase
          .from("exercises")
          .select("*");

        if (exerciseDetailsByName) {
          const wantedNames = new Set(
            exerciseNames.map((name) => name.toLowerCase().trim())
          );

          exerciseDetailsNameMap = Object.fromEntries(
            exerciseDetailsByName
              .filter((ex) => wantedNames.has(ex.name.toLowerCase().trim()))
              .map((ex) => [ex.name.toLowerCase().trim(), ex])
          );
        }
      }

      const enrichedExercises = exerciseData.map((ex) => ({
        ...ex,
        exercise_details:
          (ex.exercise_id ? exerciseDetailsMap[ex.exercise_id] : null) ||
          (ex.exercise_name
            ? exerciseDetailsNameMap[ex.exercise_name.toLowerCase().trim()] ||
              null
            : null),
      }));

      setDayExercises(enrichedExercises);

      // Only set the active exercise if there isn't one already, OR if the
      // current active exercise isn't in this day's exercises (e.g. switched days).
      // This prevents the "jumps back to first exercise after marking a set" bug.
      setActiveExerciseId((current) => {
        if (current && enrichedExercises.some((e) => e.id === current)) {
          return current;
        }
        return enrichedExercises[0]?.id ?? "";
      });

      const exerciseRecordIds = enrichedExercises.map((e) => e.id);

      if (exerciseRecordIds.length > 0) {
        const { data: setLogData, error: setLogError } = await supabase
          .from("client_program_set_logs")
          .select("*")
          .eq("client_id", client.id)
          .eq("client_program_id", clientProgram.id)
          .eq("client_program_day_id", selectedDay.id)
          .eq("log_date", today)
          .in("client_program_day_exercise_id", exerciseRecordIds);

        if (!setLogError && setLogData) {
          setSetLogs(setLogData);
        } else {
          setSetLogs([]);
        }
      } else {
        setSetLogs([]);
      }

      // Load previous weights
      const exerciseNamesForPrevious = Array.from(
        new Set(
          enrichedExercises
            .map((exercise) => exercise.exercise_name?.trim())
            .filter(Boolean)
        )
      ) as string[];

      if (exerciseNamesForPrevious.length > 0) {
        const previousWeightLookup: Record<string, number | null> = {};
        const progressionSuggestionLookup: ProgressionSuggestionMap = {};

        for (const exerciseName of exerciseNamesForPrevious) {
          const { data: matchingExercises } = await supabase
            .from("client_program_day_exercises")
            .select("id")
            .eq("exercise_name", exerciseName);

          const matchingExerciseIds =
            matchingExercises?.map((exercise) => exercise.id) ?? [];

          if (matchingExerciseIds.length === 0) {
            previousWeightLookup[exerciseName] = null;
            progressionSuggestionLookup[exerciseName] = null;
            continue;
          }

          const { data: previousLogs } = await supabase
            .from("client_program_set_logs")
            .select("actual_weight_kg, actual_reps, completed, log_date, set_number, created_at")
            .eq("client_id", client.id)
            .in("client_program_day_exercise_id", matchingExerciseIds)
            .lt("log_date", today)
            .not("actual_weight_kg", "is", null)
            .order("log_date", { ascending: false })
            .order("set_number", { ascending: true });

          previousWeightLookup[exerciseName] =
            previousLogs && previousLogs.length > 0
              ? previousLogs[0].actual_weight_kg
              : null;

          const exerciseForSuggestion = enrichedExercises.find(
            (exercise) => exercise.exercise_name?.trim() === exerciseName
          );

          progressionSuggestionLookup[exerciseName] =
            exerciseForSuggestion && previousLogs
              ? getProgressionSuggestion(exerciseForSuggestion, previousLogs)
              : null;
        }

        setPreviousWeights(previousWeightLookup);
        setProgressionSuggestions(progressionSuggestionLookup);
      }
    };

    loadSelectedDay();
  }, [selectedDayId, client, clientProgram, programDays]);

  const reloadWorkout = async () => {
    await loadWorkout();
  };

  const getSetLog = (exerciseId: string, setNumber: number) =>
    setLogs.find(
      (log) =>
        log.client_program_day_exercise_id === exerciseId &&
        log.set_number === setNumber
    ) || null;

  const getDraftKey = (exerciseId: string, setNumber: number) =>
    `${exerciseId}-${setNumber}`;

  const parseTargetReps = (reps: string | null) => {
    if (!reps) return null;

    const numbers = reps.match(/\d+/g)?.map(Number) ?? [];
    if (numbers.length === 0) return null;

    return Math.max(...numbers);
  };

  const roundToNearestHalf = (value: number) => Math.round(value * 2) / 2;

  const getProgressionSuggestion = (
    exercise: ClientProgramDayExercise,
    logs: Array<{
      actual_weight_kg: number | null;
      actual_reps: number | null;
      completed: boolean;
      log_date: string | null;
      set_number: number;
    }>
  ): ExerciseProgressionSuggestion | null => {
    const targetSets = exercise.sets ?? 0;
    if (targetSets <= 0) return null;

    const targetReps = parseTargetReps(exercise.reps);
    const logsByDate = new Map<string, typeof logs>();

    for (const log of logs) {
      if (!log.log_date || log.actual_weight_kg === null) continue;
      logsByDate.set(log.log_date, [...(logsByDate.get(log.log_date) ?? []), log]);
    }

    const completedSessions = Array.from(logsByDate.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, sessionLogs]) => {
        const completedLogs = sessionLogs.filter((log) => log.completed);
        if (completedLogs.length < targetSets) return null;

        const firstSets = completedLogs
          .sort((a, b) => a.set_number - b.set_number)
          .slice(0, targetSets);

        const weights = firstSets.map((log) => log.actual_weight_kg);
        if (weights.some((weight) => weight === null)) return null;

        const sessionWeight = weights[0] as number;
        const sameWeight = weights.every((weight) => weight === sessionWeight);
        if (!sameWeight) return null;

        const repsHit =
          targetReps === null ||
          firstSets.every(
            (log) => log.actual_reps !== null && log.actual_reps >= targetReps
          );

        if (!repsHit) return null;

        return { date, weight: sessionWeight };
      })
      .filter(Boolean) as Array<{ date: string; weight: number }>;

    if (completedSessions.length < 2) return null;

    const [latest, previous] = completedSessions;
    if (latest.weight !== previous.weight) return null;

    const increaseFactor = latest.weight < 20 ? 1.1 : 1.05;
    const suggestedWeight = roundToNearestHalf(latest.weight * increaseFactor);

    if (suggestedWeight <= latest.weight) return null;

    return {
      lastWeight: latest.weight,
      suggestedWeight,
      sessionsAtWeight: 2,
    };
  };

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

  const getDisplayWeight = (
    exercise: ClientProgramDayExercise,
    setNumber: number
  ) => {
    const key = getDraftKey(exercise.id, setNumber);

    if (drafts[key]?.weight !== undefined) return drafts[key].weight;

    const setLog = getSetLog(exercise.id, setNumber);

    if (
      setLog?.actual_weight_kg !== null &&
      setLog?.actual_weight_kg !== undefined
    ) {
      return String(setLog.actual_weight_kg);
    }

    const rememberedWeight = getRememberedWeight(exercise);
    if (rememberedWeight !== "") return rememberedWeight;

    if (
      exercise.target_weight_kg !== null &&
      exercise.target_weight_kg !== undefined
    ) {
      return String(exercise.target_weight_kg);
    }

    return "";
  };

  const getDisplayReps = (
    exercise: ClientProgramDayExercise,
    setNumber: number
  ) => {
    const key = getDraftKey(exercise.id, setNumber);

    if (drafts[key]?.reps !== undefined) return drafts[key].reps;

    const setLog = getSetLog(exercise.id, setNumber);

    if (setLog?.actual_reps !== null && setLog?.actual_reps !== undefined) {
      return String(setLog.actual_reps);
    }

    return getDefaultReps(exercise);
  };

  const totalSetCount = useMemo(
    () =>
      dayExercises.reduce(
        (sum, exercise) => sum + Math.max(exercise.sets ?? 1, 1),
        0
      ),
    [dayExercises]
  );

  const completedSetCount = useMemo(() => {
    return dayExercises.reduce((sum, exercise) => {
      const targetSets = Math.max(exercise.sets ?? 1, 1);
      const completedSets = setLogs.filter(
        (log) =>
          log.client_program_day_exercise_id === exercise.id &&
          log.completed &&
          log.set_number <= targetSets
      ).length;

      return sum + Math.min(completedSets, targetSets);
    }, 0);
  }, [dayExercises, setLogs]);

  const completionPercentage =
    totalSetCount > 0
      ? Math.round((completedSetCount / totalSetCount) * 100)
      : 0;

  const isAllSetsComplete = totalSetCount > 0 && completedSetCount >= totalSetCount;

  const calendarProgramWeek = useMemo(() => {
    if (!clientProgram?.program_start_date) {
      return clientProgram?.current_week && clientProgram.current_week > 0
        ? clientProgram.current_week
        : null;
    }

    const startMonday = getMondayOf(clientProgram.program_start_date);
    const weekStartDate = parseLocalDate(weekStart);
    const startMondayDate = parseLocalDate(startMonday);
    const millisecondsPerWeek = 7 * 24 * 60 * 60 * 1000;
    const weekOffset = Math.floor(
      (weekStartDate.getTime() - startMondayDate.getTime()) /
        millisecondsPerWeek
    );

    return Math.max(weekOffset + 1, 1);
  }, [clientProgram?.current_week, clientProgram?.program_start_date, weekStart]);

  const activeExercise =
    dayExercises.find((exercise) => exercise.id === activeExerciseId) ??
    dayExercises[0] ??
    null;

  const activeProgressionSuggestion = activeExercise?.exercise_name
    ? progressionSuggestions[activeExercise.exercise_name] ?? null
    : null;

  const currentDayCompletion = currentDay
    ? workoutCompletions.find(
        (completion) =>
          completion.client_program_day_id === currentDay.id &&
          completion.completed_date === today
      ) ?? null
    : null;

  const currentDayCompletedToday = Boolean(currentDayCompletion);

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
    const nextLogValues = {
      actual_weight_kg:
        updates.actual_weight_kg ?? existing?.actual_weight_kg ?? null,
      actual_reps: updates.actual_reps ?? existing?.actual_reps ?? null,
      completed: updates.completed ?? existing?.completed ?? false,
    };
    const offlineSetPayload = {
      client_id: clientId,
      client_program_id: clientProgramId,
      client_program_day_id: clientProgramDayId,
      client_program_day_exercise_id: exerciseId,
      log_date: today,
      set_number: setNumber,
      ...nextLogValues,
    };

    if (!existing && clientProgram?.program_start_date === null) {
      if (canTryNetworkWrite()) {
        const { error } = await supabase
          .from("client_programs")
          .update({
            program_start_date: today,
            current_week: 1,
          })
          .eq("id", clientProgramId);

        if (error) {
          queueOfflineWorkoutItem({
            id: createOfflineId("program-start"),
            type: "program_start",
            createdAt: queueCreatedAt(),
            payload: {
              client_program_id: clientProgramId,
              program_start_date: today,
              current_week: 1,
            },
          });
        }
      } else {
        queueOfflineWorkoutItem({
          id: createOfflineId("program-start"),
          type: "program_start",
          createdAt: queueCreatedAt(),
          payload: {
            client_program_id: clientProgramId,
            program_start_date: today,
            current_week: 1,
          },
        });
      }

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
      const localLog = {
        ...existing,
        ...nextLogValues,
      };

      if (existing.id.startsWith("offline-set-")) {
        queueOfflineWorkoutItem({
          id: createOfflineId("set-log"),
          type: "set_log_upsert",
          createdAt: queueCreatedAt(),
          payload: offlineSetPayload,
        });
        setSetLogs((prev) =>
          prev.map((log) => (log.id === existing.id ? localLog : log))
        );
        setSavingKey(null);
        return;
      }

      if (!canTryNetworkWrite()) {
        queueOfflineWorkoutItem({
          id: createOfflineId("set-log-update"),
          type: "set_log_update",
          createdAt: queueCreatedAt(),
          payload: {
            id: existing.id,
            updates: nextLogValues,
          },
        });
        setSetLogs((prev) =>
          prev.map((log) => (log.id === existing.id ? localLog : log))
        );
        setSavingKey(null);
        return;
      }

      const { data, error } = await supabase
        .from("client_program_set_logs")
        .update(nextLogValues)
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        queueOfflineWorkoutItem({
          id: createOfflineId("set-log-update"),
          type: "set_log_update",
          createdAt: queueCreatedAt(),
          payload: {
            id: existing.id,
            updates: nextLogValues,
          },
        });
        setSetLogs((prev) =>
          prev.map((log) => (log.id === existing.id ? localLog : log))
        );
        setSavingKey(null);
        return;
      }

      setSetLogs((prev) =>
        prev.map((log) => (log.id === existing.id ? data : log))
      );
    } else {
      if (!canTryNetworkWrite()) {
        const offlineLog = {
          id: createOfflineId("offline-set"),
          client_program_day_exercise_id: exerciseId,
          set_number: setNumber,
          log_date: today,
          ...nextLogValues,
        };

        queueOfflineWorkoutItem({
          id: createOfflineId("set-log"),
          type: "set_log_upsert",
          createdAt: queueCreatedAt(),
          payload: offlineSetPayload,
        });
        setSetLogs((prev) => [...prev, offlineLog]);
        setSavingKey(null);
        return;
      }

      const { data, error } = await supabase
        .from("client_program_set_logs")
        .insert([offlineSetPayload])
        .select()
        .single();

      if (error) {
        const offlineLog = {
          id: createOfflineId("offline-set"),
          client_program_day_exercise_id: exerciseId,
          set_number: setNumber,
          log_date: today,
          ...nextLogValues,
        };

        queueOfflineWorkoutItem({
          id: createOfflineId("set-log"),
          type: "set_log_upsert",
          createdAt: queueCreatedAt(),
          payload: offlineSetPayload,
        });
        setSetLogs((prev) => [...prev, offlineLog]);
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

    if (checked && canTryNetworkWrite()) {
      const unlockedAchievements = await updateStreak(
        client.id,
        "workout",
        today
      ).catch(() => []);

      if (unlockedAchievements.length > 0) {
        const achievementType = unlockedAchievements[0];

        const achievementDetails: Record<string, CelebrationAchievement> = {
          workout_streak_7: {
            icon: "🔥",
            title: "Week Warrior",
            description: "7-day workout streak!",
          },
          workout_streak_30: {
            icon: "💪",
            title: "Month Master",
            description: "30-day workout streak!",
          },
          workout_streak_100: {
            icon: "👑",
            title: "Century Champion",
            description: "100-day workout streak!",
          },
        };

        if (achievementDetails[achievementType]) {
          setCelebrationAchievement(achievementDetails[achievementType]);
        }
      }
    }

    if (checked && exercise.exercise_details?.rest) {
      setRestTimer({
        exerciseId: exercise.id,
        setNumber,
        secondsRemaining: exercise.exercise_details.rest,
        totalSeconds: exercise.exercise_details.rest,
      });

      // Companion speaks on rest 1, then every 5th rest of the session.
      const newRestCount = restCount + 1;
      setRestCount(newRestCount);

      if (
        companionEnabled &&
        companionView &&
        (newRestCount === 1 || newRestCount % 5 === 0)
      ) {
        const slug = companionView.path.slug;

        // Try a couple of times to avoid immediate repeats.
        let line = await getRandomLine(
          slug,
          "rest_timer",
          companionView.currentForm.form_number
        );
        if (line && line === lastLineRef.current) {
          const second = await getRandomLine(
            slug,
            "rest_timer",
            companionView.currentForm.form_number
          );
          if (second) line = second;
        }

        if (line) {
          const personalisedLine = personalizeCompanionLine(line, companionView);
          setCompanionLine(personalisedLine);
          lastLineRef.current = line;
        }
      } else {
        setCompanionLine(null);
      }
    }
  };

  const applySuggestedWeight = (
    exercise: ClientProgramDayExercise,
    suggestedWeight: number
  ) => {
    const targetSets = exercise.sets && exercise.sets > 0 ? exercise.sets : 1;
    const weightValue = String(suggestedWeight);

    setDrafts((prev) => {
      const next = { ...prev };

      for (let setNumber = 1; setNumber <= targetSets; setNumber += 1) {
        const key = getDraftKey(exercise.id, setNumber);
        next[key] = {
          weight: weightValue,
          reps: prev[key]?.reps ?? getDisplayReps(exercise, setNumber),
        };
      }

      return next;
    });
  };

  const handleWeightChange = (
    exerciseId: string,
    setNumber: number,
    value: string
  ) => {
    const key = getDraftKey(exerciseId, setNumber);

    setDrafts((prev) => ({
      ...prev,
      [key]: {
        weight: value,
        reps: prev[key]?.reps ?? "",
      },
    }));
  };

  const handleRepsChange = (
    exerciseId: string,
    setNumber: number,
    value: string
  ) => {
    const key = getDraftKey(exerciseId, setNumber);

    setDrafts((prev) => ({
      ...prev,
      [key]: {
        weight: prev[key]?.weight ?? "",
        reps: value,
      },
    }));
  };

  const handleWeightBlur = async (
    exercise: ClientProgramDayExercise,
    setNumber: number
  ) => {
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

  const handleRepsBlur = async (
    exercise: ClientProgramDayExercise,
    setNumber: number
  ) => {
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

  const handleSwapBack = async (exercise: ClientProgramDayExercise) => {
    if (!exercise.original_exercise_id) return;

    setSwappingBack(exercise.id);

    const { error } = await supabase
      .from("client_program_day_exercises")
      .update({
        exercise_id: exercise.original_exercise_id,
        original_exercise_id: null,
      })
      .eq("id", exercise.id);

    if (error) {
      console.error("Error swapping back:", error);
      alert("Failed to swap back to original exercise.");
      setSwappingBack(null);
      return;
    }

    setSwappingBack(null);
    await loadWorkout();
  };

  const handleAddCustomExercise = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentDay || !client) return;

    setAddingExercise(true);

    const formData = new FormData(e.currentTarget);
    const exerciseName = formData.get("exercise_name") as string;
    const sets = parseInt(formData.get("sets") as string) || 3;
    const reps = formData.get("reps") as string || "10";
    const targetWeight = formData.get("target_weight") as string;

    // Get max sort_order
    const maxSortOrder = dayExercises.reduce(
      (max, ex) => Math.max(max, ex.sort_order || 0),
      0
    );

    const { error } = await supabase
      .from("client_program_day_exercises")
      .insert({
        client_program_day_id: currentDay.id,
        exercise_id: null,
        exercise_name: exerciseName,
        sets,
        reps,
        target_weight_kg: targetWeight ? parseFloat(targetWeight) : null,
        sort_order: maxSortOrder + 1,
        is_custom: true,
        original_exercise_id: null,
      });

    if (error) {
      console.error("Error adding exercise:", error);
      alert("Failed to add exercise.");
      setAddingExercise(false);
      return;
    }

    setAddingExercise(false);
    setShowAddExercise(false);
    await loadWorkout();
  };

  const handleToggleDayCompletion = async () => {
    if (!client || !clientProgram || !currentDay) return;

    setCompletingDay(true);

    if (currentDayCompletedToday && currentDayCompletion) {
      if (currentDayCompletion.id.startsWith("offline-completion-")) {
        removeQueuedCompletion({
          client_id: currentDayCompletion.client_id,
          client_program_id: currentDayCompletion.client_program_id,
          client_program_day_id: currentDayCompletion.client_program_day_id,
          completed_date: currentDayCompletion.completed_date,
          completed_at: currentDayCompletion.completed_at ?? queueCreatedAt(),
        });

        setWorkoutCompletions((prev) =>
          prev.filter((completion) => completion.id !== currentDayCompletion.id)
        );
        setCompletingDay(false);
        alert("Workout day marked as incomplete for today.");
        return;
      }

      if (!canTryNetworkWrite()) {
        queueOfflineWorkoutItem({
          id: createOfflineId("completion-delete"),
          type: "completion_delete",
          createdAt: queueCreatedAt(),
          payload: {
            completion_id: currentDayCompletion.id,
          },
        });
        setWorkoutCompletions((prev) =>
          prev.filter((completion) => completion.id !== currentDayCompletion.id)
        );
        setCompletingDay(false);
        alert("Workout day marked as incomplete for today. It will sync when you are back online.");
        return;
      }

      const { error } = await supabase
        .from("client_workout_completions")
        .delete()
        .eq("id", currentDayCompletion.id);

      if (error) {
        queueOfflineWorkoutItem({
          id: createOfflineId("completion-delete"),
          type: "completion_delete",
          createdAt: queueCreatedAt(),
          payload: {
            completion_id: currentDayCompletion.id,
          },
        });
        setWorkoutCompletions((prev) =>
          prev.filter((completion) => completion.id !== currentDayCompletion.id)
        );
        setCompletingDay(false);
        alert("Workout day marked as incomplete for today. It will sync when you are back online.");
        return;
      }

      setWorkoutCompletions((prev) =>
        prev.filter((completion) => completion.id !== currentDayCompletion.id)
      );
      setCompletingDay(false);
      alert("Workout day marked as incomplete for today.");
      return;
    }

    const completionPayload = {
      client_id: client.id,
      client_program_id: clientProgram.id,
      client_program_day_id: currentDay.id,
      completed_date: today,
      completed_at: new Date().toISOString(),
    };

    if (!canTryNetworkWrite()) {
      const offlineCompletion = {
        id: createOfflineId("offline-completion"),
        ...completionPayload,
      };

      queueOfflineWorkoutItem({
        id: createOfflineId("completion"),
        type: "completion_upsert",
        createdAt: queueCreatedAt(),
        payload: completionPayload,
      });

      const updatedCompletions = [
        ...workoutCompletions.filter(
          (completion) =>
            !(
              completion.client_program_day_id === currentDay.id &&
              completion.completed_date === today
            )
        ),
        offlineCompletion,
      ];

      setWorkoutCompletions(updatedCompletions);

      const sortedDays = [...programDays].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
      );
      const currentDayIndex = sortedDays.findIndex(
        (day) => day.id === currentDay.id
      );
      const nextDay =
        currentDayIndex >= 0
          ? sortedDays[(currentDayIndex + 1) % sortedDays.length]
          : getNextWorkoutDay(programDays, updatedCompletions);

      if (nextDay) {
        setSelectedDayId(nextDay.id);
      }

      setCompletingDay(false);
      alert("Workout day completed! It will sync when you are back online.");
      return;
    }

    const { data, error } = await supabase
      .from("client_workout_completions")
      .upsert(
        completionPayload,
        {
          onConflict:
            "client_id,client_program_id,client_program_day_id,completed_date",
        }
      )
      .select()
      .single();

    if (error) {
      const offlineCompletion = {
        id: createOfflineId("offline-completion"),
        ...completionPayload,
      };

      queueOfflineWorkoutItem({
        id: createOfflineId("completion"),
        type: "completion_upsert",
        createdAt: queueCreatedAt(),
        payload: completionPayload,
      });

      setWorkoutCompletions((prev) => [
        ...prev.filter(
          (completion) =>
            !(
              completion.client_program_day_id === currentDay.id &&
              completion.completed_date === today
            )
        ),
        offlineCompletion,
      ]);
      setCompletingDay(false);
      alert("Workout day completed! It will sync when you are back online.");
      return;
    }

    const updatedCompletions = [
      ...workoutCompletions.filter(
        (completion) =>
          !(
            completion.client_program_day_id === currentDay.id &&
            completion.completed_date === today
          )
      ),
      data,
    ];

    setWorkoutCompletions(updatedCompletions);

    const sortedDays = [...programDays].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );
    const currentDayIndex = sortedDays.findIndex((day) => day.id === currentDay.id);
    const nextDay =
      currentDayIndex >= 0
        ? sortedDays[(currentDayIndex + 1) % sortedDays.length]
        : getNextWorkoutDay(programDays, updatedCompletions);

    if (nextDay) {
      setSelectedDayId(nextDay.id);
    }

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

    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?\/]+)/,
      /youtube\.com\/shorts\/([^&?\/]+)/,
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className={styles.display}>Workout</h1>
        <GuideLink guide="workouts" label="Watch Peter's workout guide" />
      </div>

      {(isBrowserOffline || offlineQueueCount > 0 || syncingOfflineQueue) && (
        <div className="mt-4 rounded-xl border border-gold/40 bg-gold/10 p-4 text-sm text-ink">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-semibold">
                {isBrowserOffline
                  ? "Offline workout mode"
                  : syncingOfflineQueue
                    ? "Syncing saved workout changes"
                    : "Workout changes waiting to sync"}
              </p>
              <p className="mt-1 text-ink-muted">
                {offlineQueueCount > 0
                  ? `${offlineQueueCount} change${offlineQueueCount === 1 ? "" : "s"} saved on this device. They will upload automatically when signal returns.`
                  : "You can keep logging sets here; changes will save on this device until signal returns."}
              </p>
            </div>

            {!isBrowserOffline && offlineQueueCount > 0 && (
              <button
                type="button"
                onClick={syncQueuedWorkoutChanges}
                disabled={syncingOfflineQueue}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-ink hover:bg-gold/90 disabled:opacity-60"
              >
                <RefreshCw
                  size={16}
                  className={syncingOfflineQueue ? "animate-spin" : ""}
                />
                Sync now
              </button>
            )}
          </div>
        </div>
      )}

      {restTimer && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-workout px-4 py-3 text-white shadow-lg">
          <div className="mx-auto max-w-7xl">
            <div className="flex items-center justify-between">
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
                  onClick={() => {
                    setRestTimer(null);
                    setCompanionLine(null);
                  }}
                  className="rounded-lg bg-white/20 px-3 py-1 text-sm font-medium hover:bg-white/30"
                >
                  Skip
                </button>
              </div>
            </div>

            {/* Companion speaks — only on cadence rests */}
            {companionEnabled && companionView && companionLine && (
              <div className="mt-2 flex items-center gap-2 border-t border-white/20 pt-2">
                {companionView.currentForm.image_url ? (
                  <img
                    src={companionView.currentForm.image_url}
                    alt={companionView.currentForm.name}
                    className="h-8 w-8 shrink-0 rounded-full border border-white/30 object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/10 text-xs">
                    ?
                  </div>
                )}
                <p className="text-sm italic opacity-95">
                  &quot;{companionLine}&quot;
                </p>
              </div>
            )}
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
          <ThisWeekWorkouts
            days={programDays}
            completions={workoutCompletions.filter(
              (completion) => completion.completed_date >= weekStart
            )}
            currentDayId={getNextWorkoutDay(programDays, workoutCompletions)?.id ?? null}
            selectedDayId={selectedDayId}
            weekStart={weekStart}
            onSelectDay={(dayId) => {
              setSelectedDayId(dayId);
              setShowVideo(false);
            }}
            showOpenWorkoutLink={false}
            metaLabel={
              calendarProgramWeek !== null ? `Week ${calendarProgramWeek}` : null
            }
          />

          <div className={styles.card}>
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink">
                {completedSetCount} of {totalSetCount} sets complete
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

            {isAllSetsComplete && !currentDayCompletedToday && (
              <button
                type="button"
                onClick={handleToggleDayCompletion}
                disabled={completingDay}
                className={`${styles.buttonPrimaryWorkout} mt-4 flex w-full items-center justify-center gap-2 py-3 disabled:opacity-50`}
              >
                {completingDay ? (
                  <>
                    <RefreshCw size={20} className="animate-spin" />
                    Completing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={20} />
                    Complete Workout
                  </>
                )}
              </button>
            )}
          </div>

          <ClientUnreadRepliesBanner clientId={client.id} />

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
                            : "border border-border-subtle bg-surface-raised text-ink hover:bg-surface-sunken"
                        }`}
                      >
                        {exercise.exercise_name || `Exercise ${index + 1}`}
                        {exercise.is_custom && " ⭐"}
                      </button>
                    );
                  })}
                </div>

                <div className={styles.card}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-ink">
                        {activeExercise.exercise_name}
                        {activeExercise.is_custom && (
                          <span className="ml-2 rounded-full bg-gold/20 px-2 py-0.5 text-xs font-medium text-gold">
                            Custom
                          </span>
                        )}
                        {activeExercise.original_exercise_id && (
                          <span className="ml-2 rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-600">
                            Swapped
                          </span>
                        )}
                      </h3>

                      <p className="text-sm text-ink-muted">
                        Target: {activeExercise.sets ?? "-"} sets ×{" "}
                        {activeExercise.reps ?? "-"} reps
                        {activeExercise.target_weight_kg !== null
                          ? ` × ${activeExercise.target_weight_kg}kg`
                          : ""}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      {/* Swap Back Button */}
                      {activeExercise.original_exercise_id && (
                        <button
                          onClick={() => handleSwapBack(activeExercise)}
                          disabled={swappingBack === activeExercise.id}
                          className="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-sunken px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-raised hover:text-ink disabled:opacity-50"
                        >
                          {swappingBack === activeExercise.id ? (
                            <>
                              <RefreshCw size={14} className="animate-spin" />
                              Swapping...
                            </>
                          ) : (
                            <>
                              <Undo2 size={14} />
                              Swap Back
                            </>
                          )}
                        </button>
                      )}

                      {/* Alternative Exercise Button */}
                      {!activeExercise.is_custom &&
activeExercise.exercise_details?.alternate && (
  <button
    onClick={() =>
      setAlternativeModalExercise({
        exercise: activeExercise.exercise_details,
        clientProgramDayExerciseId: activeExercise.id,
      })
    }
    className="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-sunken px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-raised hover:text-ink"
  >
    <RefreshCw size={14} />
    Alternative
  </button>
)}

                    </div>
                  </div>

                  {activeProgressionSuggestion && (
                    <div className="mt-4 rounded-xl border border-gold bg-gold/10 p-4">
                      <div className="flex items-start gap-3">
                        {companionEnabled && companionView?.currentForm.image_url && (
                          <img
                            src={companionView.currentForm.image_url}
                            alt={companionView.currentForm.name}
                            className="h-10 w-10 shrink-0 rounded-full border border-gold/40 object-cover"
                          />
                        )}

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-ink">
                            {companionEnabled && companionView
                              ? companionView.currentForm.name
                              : "Progression suggestion"}
                          </p>
                          <p className="mt-1 text-sm text-ink-muted">
                            I feel like you can lift heavier this week; let&apos;s try {activeProgressionSuggestion.suggestedWeight}kg.
                            You completed your last {activeProgressionSuggestion.sessionsAtWeight} sessions at {activeProgressionSuggestion.lastWeight}kg.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            applySuggestedWeight(
                              activeExercise,
                              activeProgressionSuggestion.suggestedWeight
                            )
                          }
                          className="shrink-0 rounded-lg bg-gold px-3 py-2 text-xs font-semibold text-ink hover:bg-gold/90"
                        >
                          Use {activeProgressionSuggestion.suggestedWeight}kg
                        </button>
                      </div>
                    </div>
                  )}

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
                      ? Array.from(
                          { length: activeExercise.sets },
                          (_, i) => i + 1
                        )
                      : [1]
                    ).map((setNumber) => {
                      const setLog = getSetLog(activeExercise.id, setNumber);
                      const currentKey = getDraftKey(
                        activeExercise.id,
                        setNumber
                      );

                      const rememberedWeight =
                        activeExercise.exercise_name &&
                        previousWeights[activeExercise.exercise_name] !==
                          null &&
                        previousWeights[activeExercise.exercise_name] !==
                          undefined
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
                              value={getDisplayWeight(
                                activeExercise,
                                setNumber
                              )}
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
                              value={getDisplayReps(
                                activeExercise,
                                setNumber
                              )}
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
                            <label className="flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-raised px-3 py-2 text-sm font-medium text-ink hover:bg-surface-sunken">
                              Completed
                              <input
                                type="checkbox"
                                checked={setLog?.completed ?? false}
                                onChange={(e) =>
                                  handleToggleSet(activeExercise, setNumber, e.target.checked)
                                }
                                disabled={savingKey === currentKey}
                                className="h-4 w-4 accent-gold"
                              />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>

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

                          <div
                            className="relative overflow-hidden rounded-xl"
                            style={{ paddingBottom: "56.25%" }}
                          >
                            <iframe
                              src={
                                getYouTubeEmbedUrl(
                                  activeExercise.exercise_details.youtube_short
                                ) || ""
                              }
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

          {/* Add Custom Exercise Section */}
          {!showAddExercise ? (
            <button
              onClick={() => setShowAddExercise(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border-subtle bg-surface-raised p-4 text-sm font-medium text-ink-muted hover:border-gold hover:bg-gold/5 hover:text-ink"
            >
              <Plus size={20} />
              Add Extra Exercise
            </button>
          ) : (
            <div className={styles.card}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className={styles.h2}>Add Custom Exercise</h3>
                <button
                  onClick={() => setShowAddExercise(false)}
                  className="text-sm text-ink-muted hover:text-ink"
                >
                  Cancel
                </button>
              </div>

              <form onSubmit={handleAddCustomExercise} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-ink">
                    Exercise Name *
                  </label>
                  <input
                    type="text"
                    name="exercise_name"
                    required
                    className={styles.input}
                    placeholder="e.g., Bicep Curls"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="text-sm font-medium text-ink">
                      Sets *
                    </label>
                    <input
                      type="number"
                      name="sets"
                      required
                      min="1"
                      defaultValue="3"
                      className={styles.input}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-ink">
                      Reps *
                    </label>
                    <input
                      type="text"
                      name="reps"
                      required
                      defaultValue="10"
                      className={styles.input}
                      placeholder="e.g., 10 or 8-12"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-ink">
                      Target Weight (kg)
                    </label>
                    <input
                      type="number"
                      name="target_weight"
                      step="0.5"
                      className={styles.input}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={addingExercise}
                  className={`${styles.buttonPrimaryWorkout} w-full disabled:opacity-50`}
                >
                  {addingExercise ? "Adding..." : "Add Exercise"}
                </button>
              </form>
            </div>
          )}

          <MessageTrainerBox
            clientId={client.id}
            contextType="workout_day"
            contextId={currentDay.id}
            contextLabel={currentDay.day_name || "Workout day"}
            title="Workout note"
            placeholder="How did this workout feel? Anything your trainer should know?"
            accent="workout"
            showRecentMessages={false}
          />

          <button
            onClick={handleToggleDayCompletion}
            disabled={completingDay}
            className={`flex w-full items-center justify-center gap-2 py-3 disabled:opacity-50 ${
              currentDayCompletedToday 
                ? styles.buttonSecondary 
                : styles.buttonPrimaryWorkout
            }`}
          >
            {completingDay ? (
              <>
                <RefreshCw size={20} className="animate-spin" />
                {currentDayCompletedToday ? "Marking Incomplete..." : "Completing..."}
              </>
            ) : (
              <>
                {currentDayCompletedToday ? (
                  <>
                    <XCircle size={20} />
                    Mark Today as Incomplete
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={20} />
                    Complete Workout Day
                  </>
                )}
              </>
            )}
          </button>
        </div>
      )}

      <AchievementCelebration
        achievement={celebrationAchievement}
        onClose={() => setCelebrationAchievement(null)}
      />

      {alternativeModalExercise && (
        <AlternativeExerciseModal
          exercise={alternativeModalExercise.exercise}
          clientProgramDayExerciseId={alternativeModalExercise.clientProgramDayExerciseId}
          onClose={() => setAlternativeModalExercise(null)}
          onSwapped={reloadWorkout}
        />
      )}
    </>
  );
}
