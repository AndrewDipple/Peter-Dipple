"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type Client = {
  id: string;
  full_name: string;
};

type ClientProgram = {
  id: string;
  client_id: string;
  program_template_id: string | null;
  current_day_index: number | null;
  program_start_date: string | null;
  current_week: number | null;
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
  exercise_id: string | null;
  exercise_name: string | null;
  sets: number | null;
  reps: string | null;
  target_weight_kg: number | null;
  sort_order: number | null;
  original_exercise_id: string | null;
  is_custom: boolean | null;
  is_archived: boolean | null;
  archived_at: string | null;
  replaced_by_exercise_id: string | null;
  replacement_client_program_day_exercise_id: string | null;
};

type ExerciseLibraryItem = {
  id: string;
  name: string;
  target_muscle: string | null;
  movement_type: string | null;
  primary_equipment: string | null;
};

type EditValues = {
  exerciseName: string;
  exerciseId: string | null;
  sets: string;
  reps: string;
  weight: string;
};

const normalise = (value: string | null | undefined) =>
  (value ?? "").toLowerCase().trim();

export default function TrainerClientProgrammePage({ params }: PageProps) {
  const [clientId, setClientId] = useState("");
  const [client, setClient] = useState<Client | null>(null);
  const [clientProgram, setClientProgram] = useState<ClientProgram | null>(null);
  const [programDays, setProgramDays] = useState<ClientProgramDay[]>([]);
  const [dayExercises, setDayExercises] = useState<
    Record<string, ClientProgramDayExercise[]>
  >({});
  const [exerciseLibrary, setExerciseLibrary] = useState<ExerciseLibraryItem[]>(
    []
  );
  const [setLogCounts, setSetLogCounts] = useState<Record<string, number>>({});
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(
    null
  );
  const [editValues, setEditValues] = useState<Record<string, EditValues>>({});
  const [savingExerciseId, setSavingExerciseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const sortedDays = useMemo(
    () =>
      [...programDays].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
      ),
    [programDays]
  );

  const exerciseById = useMemo(() => {
    return new Map(exerciseLibrary.map((exercise) => [exercise.id, exercise]));
  }, [exerciseLibrary]);

  const exerciseByName = useMemo(() => {
    return new Map(
      exerciseLibrary.map((exercise) => [normalise(exercise.name), exercise])
    );
  }, [exerciseLibrary]);

  const getFilteredExercises = (search: string) => {
    const query = normalise(search);
    if (query.length < 2) return exerciseLibrary.slice(0, 8);

    return exerciseLibrary
      .filter((exercise) => normalise(exercise.name).includes(query))
      .slice(0, 8);
  };

  const loadProgramme = async () => {
    setLoading(true);

    const resolvedParams = await params;
    setClientId(resolvedParams.id);

    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .select("id, full_name")
      .eq("id", resolvedParams.id)
      .single();

    if (clientError || !clientData) {
      setClient(null);
      setLoading(false);
      return;
    }

    setClient(clientData);

    const { data: programData, error: programError } = await supabase
      .from("client_programs")
      .select("*")
      .eq("client_id", clientData.id)
      .or("status.eq.active,status.is.null")
      .order("created_at", { ascending: false })
      .limit(1);

    if (programError || !programData?.length) {
      setClientProgram(null);
      setProgramDays([]);
      setDayExercises({});
      setLoading(false);
      return;
    }

    const latestProgram = programData[0] as ClientProgram;
    setClientProgram(latestProgram);

    const { data: daysData, error: daysError } = await supabase
      .from("client_program_days")
      .select("*")
      .eq("client_program_id", latestProgram.id)
      .order("sort_order", { ascending: true });

    if (daysError || !daysData) {
      setProgramDays([]);
      setDayExercises({});
      setLoading(false);
      return;
    }

    setProgramDays(daysData as ClientProgramDay[]);

    const dayIds = daysData.map((day) => day.id);
    if (dayIds.length === 0) {
      setDayExercises({});
      setLoading(false);
      return;
    }

    const [{ data: exerciseData }, { data: libraryData }, { data: logData }] =
      await Promise.all([
        supabase
          .from("client_program_day_exercises")
          .select("*")
          .in("client_program_day_id", dayIds)
          .or("is_archived.is.null,is_archived.eq.false")
          .order("sort_order", { ascending: true }),
        supabase
          .from("exercises")
          .select("id, name, target_muscle, movement_type, primary_equipment")
          .order("name", { ascending: true }),
        supabase
          .from("client_program_set_logs")
          .select("client_program_day_exercise_id")
          .eq("client_program_id", latestProgram.id),
      ]);

    const grouped: Record<string, ClientProgramDayExercise[]> = {};
    for (const day of daysData) grouped[day.id] = [];

    for (const exercise of (exerciseData ?? []) as ClientProgramDayExercise[]) {
      if (!grouped[exercise.client_program_day_id]) {
        grouped[exercise.client_program_day_id] = [];
      }
      grouped[exercise.client_program_day_id].push(exercise);
    }

    const counts: Record<string, number> = {};
    for (const log of logData ?? []) {
      const exerciseId = log.client_program_day_exercise_id;
      counts[exerciseId] = (counts[exerciseId] ?? 0) + 1;
    }

    setDayExercises(grouped);
    setExerciseLibrary((libraryData ?? []) as ExerciseLibraryItem[]);
    setSetLogCounts(counts);
    setLoading(false);
  };

  useEffect(() => {
    loadProgramme();
  }, [params]);

  const startEdit = (exercise: ClientProgramDayExercise) => {
    const matchedExercise =
      (exercise.exercise_id ? exerciseById.get(exercise.exercise_id) : null) ??
      exerciseByName.get(normalise(exercise.exercise_name));

    setEditingExerciseId(exercise.id);
    setEditValues((prev) => ({
      ...prev,
      [exercise.id]: {
        exerciseName: matchedExercise?.name ?? exercise.exercise_name ?? "",
        exerciseId: matchedExercise?.id ?? exercise.exercise_id ?? null,
        sets: exercise.sets !== null && exercise.sets !== undefined
          ? String(exercise.sets)
          : "",
        reps: exercise.reps ?? "",
        weight:
          exercise.target_weight_kg !== null &&
          exercise.target_weight_kg !== undefined
            ? String(exercise.target_weight_kg)
            : "",
      },
    }));
  };

  const cancelEdit = (id: string) => {
    setEditingExerciseId(null);
    setEditValues((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const chooseExercise = (
    rowId: string,
    libraryExercise: ExerciseLibraryItem
  ) => {
    setEditValues((prev) => ({
      ...prev,
      [rowId]: {
        ...(prev[rowId] ?? {
          sets: "",
          reps: "",
          weight: "",
          exerciseName: "",
          exerciseId: null,
        }),
        exerciseName: libraryExercise.name,
        exerciseId: libraryExercise.id,
      },
    }));
  };

  const getSelectedExercise = (values: EditValues) =>
    (values.exerciseId ? exerciseById.get(values.exerciseId) : null) ??
    exerciseByName.get(normalise(values.exerciseName));

  const hasExerciseChanged = (
    exercise: ClientProgramDayExercise,
    values: EditValues
  ) => {
    const selectedExercise = getSelectedExercise(values);
    const selectedId = selectedExercise?.id ?? values.exerciseId;
    const nextName = selectedExercise?.name ?? values.exerciseName.trim();

    if (selectedId && exercise.exercise_id) {
      return selectedId !== exercise.exercise_id;
    }

    return normalise(nextName) !== normalise(exercise.exercise_name);
  };

  const saveExercise = async (
    dayId: string,
    exercise: ClientProgramDayExercise
  ) => {
    const values = editValues[exercise.id];
    if (!values) return;

    const selectedExercise = getSelectedExercise(values);
    const nextName = selectedExercise?.name ?? values.exerciseName.trim();

    if (!nextName) {
      alert("Please choose an exercise name.");
      return;
    }

    if ((setLogCounts[exercise.id] ?? 0) > 0 && hasExerciseChanged(exercise, values)) {
      alert("This exercise has logged sets. Use Replace Going Forward to keep the old logs intact.");
      return;
    }

    setSavingExerciseId(exercise.id);

    const { data, error } = await supabase
      .from("client_program_day_exercises")
      .update({
        exercise_id: selectedExercise?.id ?? null,
        exercise_name: nextName,
        sets: values.sets ? Number(values.sets) : null,
        reps: values.reps || null,
        target_weight_kg: values.weight ? Number(values.weight) : null,
        original_exercise_id:
          exercise.original_exercise_id ??
          (exercise.exercise_id && selectedExercise?.id !== exercise.exercise_id
            ? exercise.exercise_id
            : null),
      })
      .eq("id", exercise.id)
      .select()
      .single();

    setSavingExerciseId(null);

    if (error || !data) {
      alert("Could not update this client exercise.");
      return;
    }

    setDayExercises((prev) => ({
      ...prev,
      [dayId]: (prev[dayId] ?? []).map((row) =>
        row.id === exercise.id ? (data as ClientProgramDayExercise) : row
      ),
    }));
    cancelEdit(exercise.id);
  };

  const replaceExerciseGoingForward = async (
    dayId: string,
    exercise: ClientProgramDayExercise
  ) => {
    const values = editValues[exercise.id];
    if (!values) return;

    const selectedExercise = getSelectedExercise(values);
    const nextName = selectedExercise?.name ?? values.exerciseName.trim();

    if (!selectedExercise || !nextName) {
      alert("Choose the replacement exercise from the search results first.");
      return;
    }

    if (!hasExerciseChanged(exercise, values)) {
      alert("Choose a different exercise before replacing.");
      return;
    }

    setSavingExerciseId(exercise.id);

    const { data: replacement, error: insertError } = await supabase
      .from("client_program_day_exercises")
      .insert({
        client_program_day_id: dayId,
        exercise_id: selectedExercise.id,
        exercise_name: nextName,
        sets: values.sets ? Number(values.sets) : exercise.sets,
        reps: values.reps || exercise.reps,
        target_weight_kg: values.weight
          ? Number(values.weight)
          : exercise.target_weight_kg,
        sort_order: exercise.sort_order,
        original_exercise_id: exercise.exercise_id,
        is_custom: false,
        is_archived: false,
      })
      .select()
      .single();

    if (insertError || !replacement) {
      setSavingExerciseId(null);
      alert("Could not create the replacement exercise.");
      return;
    }

    const { error: archiveError } = await supabase
      .from("client_program_day_exercises")
      .update({
        is_archived: true,
        archived_at: new Date().toISOString(),
        replaced_by_exercise_id: selectedExercise.id,
        replacement_client_program_day_exercise_id: replacement.id,
      })
      .eq("id", exercise.id);

    setSavingExerciseId(null);

    if (archiveError) {
      alert("Replacement was created, but the old exercise could not be archived. Please refresh and check the programme.");
      return;
    }

    setDayExercises((prev) => ({
      ...prev,
      [dayId]: (prev[dayId] ?? []).map((row) =>
        row.id === exercise.id ? (replacement as ClientProgramDayExercise) : row
      ),
    }));
    cancelEdit(exercise.id);
  };

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className={styles.display}>Client Programme</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {client ? client.full_name : "Edit this client's active programme"}
          </p>
        </div>
        <Link href={`/trainer/clients/${clientId}`} className={styles.buttonSecondary}>
          Back to client
        </Link>
      </div>

      {loading ? (
        <p className={styles.body}>Loading programme...</p>
      ) : !client ? (
        <p className={styles.body}>Client not found.</p>
      ) : !clientProgram ? (
        <div className={styles.card}>
          <p className={styles.body}>
            No active programme is assigned to this client yet.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className={styles.card}>
            <h2 className={styles.h2}>Active Programme Copy</h2>
            <p className="mt-2 text-sm text-ink-muted">
              These edits apply only to {client.full_name}'s assigned programme.
              They do not change the original programme template or reset their
              current week.
            </p>
            <p className="mt-2 text-xs text-ink-muted">
              If an exercise already has logged sets, changing its name can make
              previous logs appear under the new exercise. For already-completed
              work, changing sets/reps/target is safer than replacing the
              exercise.
            </p>
          </div>

          {sortedDays.map((day) => {
            const exercises = dayExercises[day.id] ?? [];

            return (
              <section key={day.id} className={styles.card}>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className={styles.h2}>{day.day_name || "Workout Day"}</h2>
                  <p className="text-sm text-ink-muted">
                    {exercises.length} exercise{exercises.length === 1 ? "" : "s"}
                  </p>
                </div>

                <div className="mt-4 space-y-3">
                  {exercises.length === 0 ? (
                    <p className={styles.body}>No exercises on this day.</p>
                  ) : (
                    exercises.map((exercise) => {
                      const isEditing = editingExerciseId === exercise.id;
                      const values = editValues[exercise.id];
                      const logCount = setLogCounts[exercise.id] ?? 0;
                      const exerciseChanged = values
                        ? hasExerciseChanged(exercise, values)
                        : false;
                      const filteredExercises = getFilteredExercises(
                        values?.exerciseName ?? exercise.exercise_name ?? ""
                      );

                      return (
                        <div
                          key={exercise.id}
                          className="rounded-xl border border-border-subtle bg-surface-raised p-4"
                        >
                          {!isEditing ? (
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                              <div className="min-w-0">
                                <p className="font-semibold text-ink">
                                  {exercise.exercise_name || "Exercise"}
                                </p>
                                <p className="mt-1 text-sm text-ink-muted">
                                  {exercise.sets ?? "-"} sets ·{" "}
                                  {exercise.reps ?? "-"} reps
                                  {exercise.target_weight_kg !== null &&
                                  exercise.target_weight_kg !== undefined
                                    ? ` · ${exercise.target_weight_kg}kg`
                                    : ""}
                                </p>
                                {logCount > 0 && (
                                  <p className="mt-1 text-xs font-medium text-gold">
                                    {logCount} logged set
                                    {logCount === 1 ? "" : "s"} attached
                                  </p>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => startEdit(exercise)}
                                className={styles.buttonSecondary}
                              >
                                Edit
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {logCount > 0 && (
                                <div className="rounded-lg border border-gold bg-gold/10 p-3 text-sm text-ink">
                                  This exercise has logged sets. Editing targets
                                  is fine. If you need a different exercise, use
                                  Replace Going Forward to keep older logs
                                  attached to the original exercise.
                                </div>
                              )}

                              <div>
                                <label className="text-sm font-medium text-ink">
                                  Exercise
                                </label>
                                <input
                                  value={values?.exerciseName ?? ""}
                                  onChange={(event) =>
                                    setEditValues((prev) => ({
                                      ...prev,
                                      [exercise.id]: {
                                        ...(prev[exercise.id] ?? {
                                          sets: "",
                                          reps: "",
                                          weight: "",
                                          exerciseName: "",
                                          exerciseId: null,
                                        }),
                                        exerciseName: event.target.value,
                                        exerciseId: null,
                                      },
                                    }))
                                  }
                                  className={styles.input}
                                  placeholder="Search exercises"
                                />
                                <div className="mt-2 grid gap-2 md:grid-cols-2">
                                  {filteredExercises.map((item) => (
                                    <button
                                      key={item.id}
                                      type="button"
                                      onClick={() =>
                                        chooseExercise(exercise.id, item)
                                      }
                                      className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                                        values?.exerciseId === item.id
                                          ? "border-gold bg-gold/10 text-ink"
                                          : "border-border-subtle bg-surface-sunken text-ink hover:border-gold"
                                      }`}
                                    >
                                      <span className="block font-medium">
                                        {item.name}
                                      </span>
                                      <span className="mt-0.5 block text-xs text-ink-muted">
                                        {[item.primary_equipment, item.target_muscle]
                                          .filter(Boolean)
                                          .join(" · ") || "No tags"}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="grid gap-4 md:grid-cols-3">
                                <div>
                                  <label className="text-sm font-medium text-ink">
                                    Sets
                                  </label>
                                  <input
                                    type="number"
                                    value={values?.sets ?? ""}
                                    onChange={(event) =>
                                      setEditValues((prev) => ({
                                        ...prev,
                                        [exercise.id]: {
                                          ...(prev[exercise.id] as EditValues),
                                          sets: event.target.value,
                                        },
                                      }))
                                    }
                                    className={styles.input}
                                  />
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-ink">
                                    Reps
                                  </label>
                                  <input
                                    value={values?.reps ?? ""}
                                    onChange={(event) =>
                                      setEditValues((prev) => ({
                                        ...prev,
                                        [exercise.id]: {
                                          ...(prev[exercise.id] as EditValues),
                                          reps: event.target.value,
                                        },
                                      }))
                                    }
                                    className={styles.input}
                                  />
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-ink">
                                    Target weight (kg)
                                  </label>
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={values?.weight ?? ""}
                                    onChange={(event) =>
                                      setEditValues((prev) => ({
                                        ...prev,
                                        [exercise.id]: {
                                          ...(prev[exercise.id] as EditValues),
                                          weight: event.target.value,
                                        },
                                      }))
                                    }
                                    className={styles.input}
                                  />
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => saveExercise(day.id, exercise)}
                                  disabled={savingExerciseId === exercise.id}
                                  className={styles.buttonPrimary}
                                >
                                  {savingExerciseId === exercise.id
                                    ? "Saving..."
                                    : "Save"}
                                </button>
                                {logCount > 0 && (
                                  <div className="flex flex-col gap-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        replaceExerciseGoingForward(
                                          day.id,
                                          exercise
                                        )
                                      }
                                      disabled={
                                        savingExerciseId === exercise.id ||
                                        !exerciseChanged
                                      }
                                      className={`${styles.buttonAccent} disabled:opacity-50`}
                                    >
                                      {savingExerciseId === exercise.id
                                        ? "Replacing..."
                                        : "Replace Going Forward"}
                                    </button>
                                    {!exerciseChanged && (
                                      <p className="text-xs text-ink-muted">
                                        Choose a different exercise to enable this.
                                      </p>
                                    )}
                                  </div>
                                )}
                                <button
                                  type="button"
                                  onClick={() => cancelEdit(exercise.id)}
                                  className={styles.buttonSecondary}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
