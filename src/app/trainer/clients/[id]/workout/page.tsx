"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/PageHeader";
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
  exercise_name: string | null;
  sets: number | null;
  reps: string | null;
  target_weight_kg: number | null;
  sort_order: number | null;
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

export default function ClientWorkoutPage() {
  const [client, setClient] = useState<Client | null>(null);
  const [clientProgram, setClientProgram] = useState<ClientProgram | null>(null);
  const [programDays, setProgramDays] = useState<ClientProgramDay[]>([]);
  const [currentDay, setCurrentDay] = useState<ClientProgramDay | null>(null);
  const [dayExercises, setDayExercises] = useState<ClientProgramDayExercise[]>([]);
  const [setLogs, setSetLogs] = useState<ClientProgramSetLog[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftValues>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [completingDay, setCompletingDay] = useState(false);

  useEffect(() => {
    const loadWorkout = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setLoading(false);
        return;
      }

      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("id, full_name, profile_id")
        .eq("profile_id", user.id)
        .single();

      if (clientError || !clientData) {
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
        setLoading(false);
        return;
      }

      setProgramDays(daysData);

      const firstIncompleteDay =
        daysData.find((day) => !day.completed) ?? daysData[0];

      setCurrentDay(firstIncompleteDay);

      const { data: exerciseData, error: exerciseError } = await supabase
        .from("client_program_day_exercises")
        .select("*")
        .eq("client_program_day_id", firstIncompleteDay.id)
        .order("sort_order", { ascending: true });

      if (!exerciseError && exerciseData) {
        setDayExercises(exerciseData);

        const exerciseIds = exerciseData.map((e) => e.id);

        if (exerciseIds.length > 0) {
          const { data: setLogData, error: setLogError } = await supabase
            .from("client_program_set_logs")
            .select("*")
            .eq("client_id", clientData.id)
            .eq("client_program_id", program.id)
            .eq("client_program_day_id", firstIncompleteDay.id)
            .in("client_program_day_exercise_id", exerciseIds);

          if (!setLogError && setLogData) {
            setSetLogs(setLogData);
          }
        }
      }

      setLoading(false);
    };

    loadWorkout();
  }, []);

  const getSetLog = (exerciseId: string, setNumber: number) => {
    return (
      setLogs.find(
        (log) =>
          log.client_program_day_exercise_id === exerciseId &&
          log.set_number === setNumber
      ) || null
    );
  };

  const getDraftKey = (exerciseId: string, setNumber: number) =>
    `${exerciseId}-${setNumber}`;

  const getDefaultReps = (exercise: ClientProgramDayExercise) => {
    if (!exercise.reps) return "";
    return /^\d+$/.test(exercise.reps.trim()) ? exercise.reps.trim() : "";
  };

  const getDisplayWeight = (
    exercise: ClientProgramDayExercise,
    setNumber: number
  ) => {
    const key = getDraftKey(exercise.id, setNumber);
    if (drafts[key]?.weight !== undefined) return drafts[key].weight;

    const setLog = getSetLog(exercise.id, setNumber);
    if (setLog?.actual_weight_kg !== null && setLog?.actual_weight_kg !== undefined) {
      return String(setLog.actual_weight_kg);
    }

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

    if (nextDay && nextDay.id !== currentDay.id) {
      setCurrentDay(nextDay);

      const { data: nextExerciseData, error: nextExerciseError } = await supabase
        .from("client_program_day_exercises")
        .select("*")
        .eq("client_program_day_id", nextDay.id)
        .order("sort_order", { ascending: true });

      if (!nextExerciseError && nextExerciseData) {
        setDayExercises(nextExerciseData);

        if (client && clientProgram) {
          const nextExerciseIds = nextExerciseData.map((e) => e.id);

          if (nextExerciseIds.length > 0) {
            const { data: nextSetLogs, error: nextSetLogError } = await supabase
              .from("client_program_set_logs")
              .select("*")
              .eq("client_id", client.id)
              .eq("client_program_id", clientProgram.id)
              .eq("client_program_day_id", nextDay.id)
              .in("client_program_day_exercise_id", nextExerciseIds);

            if (!nextSetLogError && nextSetLogs) {
              setSetLogs(nextSetLogs);
            } else {
              setSetLogs([]);
            }
          } else {
            setSetLogs([]);
          }
        }
      }
    } else {
      setCurrentDay(null);
      setDayExercises([]);
      setSetLogs([]);
    }

    setDrafts({});
    setCompletingDay(false);
    alert("Workout day completed!");
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow">
          <p className="text-slate-800">Loading workout...</p>
        </div>
      </main>
    );
  }

  if (!client) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow">
          <p className="text-slate-800">Client not found.</p>
        </div>
      </main>
    );
  }

  if (!clientProgram || !currentDay) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Workout</h1>
            <Link
              href="/client/dashboard"
              className="rounded-xl border border-slate-300 px-4 py-2"
            >
              Back
            </Link>
          </div>

          <p className="mt-6 text-slate-800">
            No active programme day available yet.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Workout</h1>
            <p className="mt-1 text-sm text-slate-700">
              Current day: {currentDay.day_name || "Workout Day"}
            </p>
          </div>

          <Link
            href="/client/dashboard"
            className="rounded-xl border border-slate-300 px-4 py-2"
          >
            Back
          </Link>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {currentDay.day_name || "Workout Day"}
            </h2>
            <span className="text-sm text-slate-900">
              {completedExerciseCount} of {totalExercises} exercises complete
            </span>
          </div>

          <div className="mt-3">
            <div className="h-3 w-full rounded-full bg-slate-200">
              <div
                className="h-3 rounded-full bg-black transition-all"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-slate-800">
              {completionPercentage}% completed
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {dayExercises.length > 0 ? (
            dayExercises.map((exercise) => {
              const targetSets = exercise.sets ?? 0;
              const setNumbers =
                targetSets > 0
                  ? Array.from({ length: targetSets }, (_, i) => i + 1)
                  : [1];

              return (
                <div
                  key={exercise.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <p className="font-medium text-slate-900">
                    {exercise.exercise_name}
                  </p>
                  <p className="text-sm text-slate-800">
                    Target: {exercise.sets ?? "-"} sets × {exercise.reps ?? "-"} reps
                    {exercise.target_weight_kg !== null
                      ? ` × ${exercise.target_weight_kg}kg`
                      : ""}
                  </p>

                  <div className="mt-4 space-y-3">
                    {setNumbers.map((setNumber) => {
                      const setLog = getSetLog(exercise.id, setNumber);
                      const currentKey = getDraftKey(exercise.id, setNumber);

                      return (
                        <div
                          key={setNumber}
                          className="grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-12"
                        >
                          <div className="md:col-span-2 flex items-center">
                            <label className="flex items-center gap-2 text-sm font-medium">
                              <input
                                type="checkbox"
                                checked={setLog?.completed ?? false}
                                onChange={(e) =>
                                  handleToggleSet(exercise, setNumber, e.target.checked)
                                }
                                disabled={savingKey === currentKey}
                              />
                              Set {setNumber}
                            </label>
                          </div>

                          <div className="md:col-span-5">
                            <label className="text-sm font-medium">Weight (kg)</label>
                            <input
                              type="number"
                              step="0.5"
                              value={getDisplayWeight(exercise, setNumber)}
                              onChange={(e) =>
                                handleWeightChange(
                                  exercise.id,
                                  setNumber,
                                  e.target.value
                                )
                              }
                              onBlur={() => handleWeightBlur(exercise, setNumber)}
                              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                              placeholder="Weight"
                            />
                          </div>

                          <div className="md:col-span-5">
                            <label className="text-sm font-medium">
                              Reps completed
                            </label>
                            <input
                              type="number"
                              value={getDisplayReps(exercise, setNumber)}
                              onChange={(e) =>
                                handleRepsChange(
                                  exercise.id,
                                  setNumber,
                                  e.target.value
                                )
                              }
                              onBlur={() => handleRepsBlur(exercise, setNumber)}
                              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                              placeholder="Reps"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-slate-800">No exercises assigned for this day yet.</p>
          )}
        </div>

        <button
          onClick={handleCompleteDay}
          disabled={completingDay}
          className="mt-6 w-full rounded-xl bg-black py-3 text-white disabled:opacity-50"
        >
          {completingDay ? "Completing..." : "Complete Workout Day"}
        </button>
      </div>
    </main>
  );
}