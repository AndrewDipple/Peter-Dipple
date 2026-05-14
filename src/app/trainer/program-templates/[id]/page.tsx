"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";
import Link from "next/link";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type ProgramTemplate = {
  id: string;
  name: string;
  duration_weeks: number | null;
  days_per_week: number | null;
  workout_location: string | null;
};

type ProgramTemplateDay = {
  id: string;
  program_template_id: string;
  day_name: string | null;
  sort_order: number | null;
};

type ProgramTemplateExercise = {
  id: string;
  program_template_day_id: string;
  exercise_name: string | null;
  sets: number | null;
  reps: string | null;
  target_weight_kg: number | null;
  sort_order: number | null;
};

type ExerciseLibraryItem = {
  name: string;
  target_muscle: string | null;
  movement_type: string | null;
  primary_equipment: string | null;
};

type RemovedExercise = {
  dayId: string;
  exercise: ProgramTemplateExercise;
};

const workoutLocationOptions = [
  { value: "gym", label: "Gym" },
  { value: "home_weights", label: "Home weights" },
];

export default function ProgramTemplateDetailPage({ params }: PageProps) {
  const [templateId, setTemplateId] = useState("");
  const [template, setTemplate] = useState<ProgramTemplate | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateDurationWeeks, setTemplateDurationWeeks] = useState("4");
  const [templateDaysPerWeek, setTemplateDaysPerWeek] = useState("3");
  const [templateWorkoutLocation, setTemplateWorkoutLocation] = useState("gym");
  const [days, setDays] = useState<ProgramTemplateDay[]>([]);
  const [exercisesByDay, setExercisesByDay] = useState<
    Record<string, ProgramTemplateExercise[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [addingDay, setAddingDay] = useState(false);
  const [newDayName, setNewDayName] = useState("");

  const [exerciseSearch, setExerciseSearch] = useState<Record<string, string>>(
    {}
  );
  const [exerciseResults, setExerciseResults] = useState<
    Record<string, ExerciseLibraryItem[]>
  >({});
  const [selectedExerciseName, setSelectedExerciseName] = useState<
    Record<string, string>
  >({});
  const [newExerciseSets, setNewExerciseSets] = useState<Record<string, string>>(
    {}
  );
  const [newExerciseReps, setNewExerciseReps] = useState<Record<string, string>>(
    {}
  );
  const [newExerciseWeight, setNewExerciseWeight] = useState<
    Record<string, string>
  >({});
  const [addingExerciseForDay, setAddingExerciseForDay] = useState<
    Record<string, boolean>
  >({});
  const [draggedExercise, setDraggedExercise] = useState<{
    dayId: string;
    exerciseId: string;
  } | null>(null);
  const [draggedDayId, setDraggedDayId] = useState<string | null>(null);
  const [reorderingDayId, setReorderingDayId] = useState<string | null>(null);
  const [reorderingDays, setReorderingDays] = useState(false);

  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(
    null
  );
  const [editExerciseValues, setEditExerciseValues] = useState<
    Record<string, { name: string; sets: string; reps: string; weight: string }>
  >({});
  const [removedExercise, setRemovedExercise] =
    useState<RemovedExercise | null>(null);

  const sortedDays = useMemo(() => {
    return [...days].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [days]);

  const sortExercises = (exercises: ProgramTemplateExercise[]) =>
    [...exercises].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const persistDayOrder = async (
    reorderedDays: ProgramTemplateDay[],
    previousDays: ProgramTemplateDay[]
  ) => {
    setReorderingDays(true);

    const results = await Promise.all(
      reorderedDays.map((day, index) =>
        supabase
          .from("program_template_days")
          .update({ sort_order: index + 1 })
          .eq("id", day.id)
      )
    );

    const failed = results.some((result) => result.error);

    if (failed) {
      setDays(previousDays);
      alert("Error reordering days");
    }

    setReorderingDays(false);
  };

  const reorderDay = async (sourceDayId: string, targetDayId: string) => {
    if (sourceDayId === targetDayId) return;

    const previousDays = [...sortedDays];
    const sourceIndex = previousDays.findIndex((day) => day.id === sourceDayId);
    const targetIndex = previousDays.findIndex((day) => day.id === targetDayId);

    if (sourceIndex === -1 || targetIndex === -1) return;

    const reorderedDays = [...previousDays];
    const [movedDay] = reorderedDays.splice(sourceIndex, 1);
    reorderedDays.splice(targetIndex, 0, movedDay);

    const withSortOrder = reorderedDays.map((day, index) => ({
      ...day,
      sort_order: index + 1,
    }));

    setDays(withSortOrder);
    await persistDayOrder(withSortOrder, previousDays);
  };

  const moveDay = async (dayId: string, direction: "up" | "down") => {
    const currentIndex = sortedDays.findIndex((day) => day.id === dayId);
    if (currentIndex === -1) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    const targetDay = sortedDays[targetIndex];
    if (!targetDay) return;

    await reorderDay(dayId, targetDay.id);
  };

  const loadPage = async () => {
    setLoading(true);

    const resolvedParams = await params;
    const id = resolvedParams.id;
    setTemplateId(id);

    const { data: templateData, error: templateError } = await supabase
      .from("program_templates")
      .select("*")
      .eq("id", id)
      .single();

    if (templateError || !templateData) {
      setTemplate(null);
      setTemplateName("");
      setTemplateDurationWeeks("4");
      setTemplateDaysPerWeek("3");
      setTemplateWorkoutLocation("gym");
      setDays([]);
      setExercisesByDay({});
      setLoading(false);
      return;
    }

    setTemplate(templateData);
    setTemplateName(templateData.name ?? "");
    setTemplateDurationWeeks(
      templateData.duration_weeks ? String(templateData.duration_weeks) : "4"
    );
    setTemplateDaysPerWeek(
      templateData.days_per_week ? String(templateData.days_per_week) : "3"
    );
    setTemplateWorkoutLocation(templateData.workout_location ?? "gym");

    const { data: dayData, error: dayError } = await supabase
      .from("program_template_days")
      .select("*")
      .eq("program_template_id", id)
      .order("sort_order", { ascending: true });

    if (dayError || !dayData) {
      setDays([]);
      setExercisesByDay({});
      setLoading(false);
      return;
    }

    setDays(dayData);

    const dayIds = dayData.map((day) => day.id);

    if (dayIds.length === 0) {
      setExercisesByDay({});
      setLoading(false);
      return;
    }

    const { data: exerciseData } = await supabase
      .from("program_template_exercises")
      .select("*")
      .in("program_template_day_id", dayIds)
      .order("sort_order", { ascending: true });

    const grouped: Record<string, ProgramTemplateExercise[]> = {};
    for (const day of dayData) {
      grouped[day.id] = [];
    }

    if (exerciseData) {
      for (const exercise of exerciseData) {
        if (!grouped[exercise.program_template_day_id]) {
          grouped[exercise.program_template_day_id] = [];
        }
        grouped[exercise.program_template_day_id].push(exercise);
      }
    }

    setExercisesByDay(grouped);
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const handleSaveTemplateDetails = async () => {
    if (!templateId || !templateName.trim()) {
      alert("Please enter a template name");
      return;
    }

    setSavingTemplate(true);

    const durationWeeks = Number(templateDurationWeeks);
    const daysPerWeek = Number(templateDaysPerWeek);

    const { error } = await supabase
      .from("program_templates")
      .update({
        name: templateName.trim(),
        duration_weeks: Number.isFinite(durationWeeks) ? durationWeeks : null,
        days_per_week: Number.isFinite(daysPerWeek) ? daysPerWeek : null,
        workout_location: templateWorkoutLocation || null,
      })
      .eq("id", templateId);

    if (error) {
      alert("Error saving template");
      setSavingTemplate(false);
      return;
    }

    setTemplate((prev) =>
      prev
        ? {
            ...prev,
            name: templateName.trim(),
            duration_weeks: Number.isFinite(durationWeeks)
              ? durationWeeks
              : null,
            days_per_week: Number.isFinite(daysPerWeek) ? daysPerWeek : null,
            workout_location: templateWorkoutLocation || null,
          }
        : prev
    );
    setSavingTemplate(false);
  };

  const handleRenameDay = async (dayId: string, dayName: string) => {
    const { error } = await supabase
      .from("program_template_days")
      .update({ day_name: dayName })
      .eq("id", dayId);

    if (error) {
      alert("Error renaming day");
      return;
    }

    setDays((prev) =>
      prev.map((day) =>
        day.id === dayId ? { ...day, day_name: dayName } : day
      )
    );
  };

  const handleAddDay = async () => {
    if (!templateId || !newDayName.trim()) {
      alert("Please enter a day name");
      return;
    }

    setAddingDay(true);

    const nextSortOrder =
      sortedDays.length > 0
        ? Math.max(...sortedDays.map((d) => d.sort_order ?? 0)) + 1
        : 1;

    const { data, error } = await supabase
      .from("program_template_days")
      .insert([
        {
          program_template_id: templateId,
          day_name: newDayName.trim(),
          sort_order: nextSortOrder,
        },
      ])
      .select()
      .single();

    if (error || !data) {
      alert("Error adding day");
      setAddingDay(false);
      return;
    }

    setDays((prev) => [...prev, data]);
    setExercisesByDay((prev) => ({ ...prev, [data.id]: [] }));
    setNewDayName("");
    setAddingDay(false);
  };

  const handleRemoveDay = async (dayId: string) => {
    const confirmed = window.confirm("Delete this day and its exercises?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("program_template_days")
      .delete()
      .eq("id", dayId);

    if (error) {
      alert("Error removing day");
      return;
    }

    setDays((prev) => prev.filter((day) => day.id !== dayId));
    setExercisesByDay((prev) => {
      const next = { ...prev };
      delete next[dayId];
      return next;
    });
  };

  const handleSearchExercises = async (dayId: string, search: string) => {
    setExerciseSearch((prev) => ({ ...prev, [dayId]: search }));

    if (!search.trim()) {
      setExerciseResults((prev) => ({ ...prev, [dayId]: [] }));
      return;
    }

    const q = search.trim().replace(/[%_,]/g, "");

    const { data, error } = await supabase
      .from("exercises")
      .select("name, target_muscle, movement_type, primary_equipment")
      .or(
        `name.ilike.%${q}%,target_muscle.ilike.%${q}%,movement_type.ilike.%${q}%,primary_equipment.ilike.%${q}%`
      )
      .order("name", { ascending: true })
      .limit(20);

    if (error || !data) {
      console.error("Exercise search error:", error);
      setExerciseResults((prev) => ({ ...prev, [dayId]: [] }));
      return;
    }

    setExerciseResults((prev) => ({ ...prev, [dayId]: data }));
  };

  const handleChooseExercise = (dayId: string, name: string) => {
    setSelectedExerciseName((prev) => ({ ...prev, [dayId]: name }));
    setExerciseSearch((prev) => ({ ...prev, [dayId]: name }));
    setExerciseResults((prev) => ({ ...prev, [dayId]: [] }));
  };

  const handleAddExerciseToDay = async (dayId: string) => {
    const exerciseName = selectedExerciseName[dayId] ?? "";

    if (!exerciseName.trim()) {
      alert("Please choose an exercise");
      return;
    }

    setAddingExerciseForDay((prev) => ({ ...prev, [dayId]: true }));

    const currentExercises = exercisesByDay[dayId] ?? [];
    const nextSortOrder =
      currentExercises.length > 0
        ? Math.max(...currentExercises.map((e) => e.sort_order ?? 0)) + 1
        : 1;

    const { data, error } = await supabase
      .from("program_template_exercises")
      .insert([
        {
          program_template_day_id: dayId,
          exercise_name: exerciseName.trim(),
          sets: newExerciseSets[dayId] ? Number(newExerciseSets[dayId]) : null,
          reps: newExerciseReps[dayId] || null,
          target_weight_kg: newExerciseWeight[dayId]
            ? Number(newExerciseWeight[dayId])
            : null,
          sort_order: nextSortOrder,
        },
      ])
      .select()
      .single();

    if (error || !data) {
      alert("Error adding exercise");
      setAddingExerciseForDay((prev) => ({ ...prev, [dayId]: false }));
      return;
    }

    setExercisesByDay((prev) => ({
      ...prev,
      [dayId]: [...(prev[dayId] ?? []), data],
    }));

    setSelectedExerciseName((prev) => ({ ...prev, [dayId]: "" }));
    setExerciseSearch((prev) => ({ ...prev, [dayId]: "" }));
    setExerciseResults((prev) => ({ ...prev, [dayId]: [] }));
    setNewExerciseSets((prev) => ({ ...prev, [dayId]: "3" }));
    setNewExerciseReps((prev) => ({ ...prev, [dayId]: "10" }));
    setNewExerciseWeight((prev) => ({ ...prev, [dayId]: "" }));
    setAddingExerciseForDay((prev) => ({ ...prev, [dayId]: false }));
  };

  const handleRemoveExercise = async (exerciseId: string, dayId: string) => {
    const exerciseToRemove = (exercisesByDay[dayId] ?? []).find(
      (exercise) => exercise.id === exerciseId
    );

    if (!exerciseToRemove) return;

    const { error } = await supabase
      .from("program_template_exercises")
      .delete()
      .eq("id", exerciseId);

    if (error) {
      alert("Error removing exercise");
      return;
    }

    setExercisesByDay((prev) => ({
      ...prev,
      [dayId]: (prev[dayId] ?? []).filter(
        (exercise) => exercise.id !== exerciseId
      ),
    }));
    setRemovedExercise({ dayId, exercise: exerciseToRemove });
  };

  const handleUndoRemoveExercise = async () => {
    if (!removedExercise) return;

    const { data, error } = await supabase
      .from("program_template_exercises")
      .insert({
        id: removedExercise.exercise.id,
        program_template_day_id: removedExercise.exercise.program_template_day_id,
        exercise_name: removedExercise.exercise.exercise_name,
        sets: removedExercise.exercise.sets,
        reps: removedExercise.exercise.reps,
        target_weight_kg: removedExercise.exercise.target_weight_kg,
        sort_order: removedExercise.exercise.sort_order,
      })
      .select()
      .single();

    if (error || !data) {
      alert("Could not restore exercise");
      return;
    }

    setExercisesByDay((prev) => ({
      ...prev,
      [removedExercise.dayId]: sortExercises([
        ...(prev[removedExercise.dayId] ?? []),
        data as ProgramTemplateExercise,
      ]),
    }));
    setRemovedExercise(null);
  };

  const persistExerciseOrder = async (
    dayId: string,
    reorderedExercises: ProgramTemplateExercise[],
    previousExercises: ProgramTemplateExercise[]
  ) => {
    setReorderingDayId(dayId);

    const updates = reorderedExercises.map((exercise, index) =>
      supabase
        .from("program_template_exercises")
        .update({ sort_order: index + 1 })
        .eq("id", exercise.id)
    );

    const results = await Promise.all(updates);
    const failed = results.some((result) => result.error);

    if (failed) {
      setExercisesByDay((prev) => ({
        ...prev,
        [dayId]: previousExercises,
      }));
      alert("Error reordering exercises");
    }

    setReorderingDayId(null);
  };

  const reorderExercise = async (
    dayId: string,
    sourceExerciseId: string,
    targetExerciseId: string
  ) => {
    if (sourceExerciseId === targetExerciseId) return;

    const previousExercises = sortExercises(exercisesByDay[dayId] ?? []);
    const sourceIndex = previousExercises.findIndex(
      (exercise) => exercise.id === sourceExerciseId
    );
    const targetIndex = previousExercises.findIndex(
      (exercise) => exercise.id === targetExerciseId
    );

    if (sourceIndex === -1 || targetIndex === -1) return;

    const reorderedExercises = [...previousExercises];
    const [movedExercise] = reorderedExercises.splice(sourceIndex, 1);
    reorderedExercises.splice(targetIndex, 0, movedExercise);

    const withSortOrder = reorderedExercises.map((exercise, index) => ({
      ...exercise,
      sort_order: index + 1,
    }));

    setExercisesByDay((prev) => ({
      ...prev,
      [dayId]: withSortOrder,
    }));

    await persistExerciseOrder(dayId, withSortOrder, previousExercises);
  };

  const moveExercise = async (
    dayId: string,
    exerciseId: string,
    direction: "up" | "down"
  ) => {
    const currentExercises = sortExercises(exercisesByDay[dayId] ?? []);
    const currentIndex = currentExercises.findIndex(
      (exercise) => exercise.id === exerciseId
    );

    if (currentIndex === -1) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    const targetExercise = currentExercises[targetIndex];

    if (!targetExercise) return;

    await reorderExercise(dayId, exerciseId, targetExercise.id);
  };

  const handleStartEditExercise = (exercise: ProgramTemplateExercise) => {
    setEditingExerciseId(exercise.id);

    setEditExerciseValues((prev) => ({
      ...prev,
      [exercise.id]: {
        name: exercise.exercise_name ?? "",
        sets: exercise.sets ? String(exercise.sets) : "",
        reps: exercise.reps ?? "",
        weight:
          exercise.target_weight_kg !== null &&
          exercise.target_weight_kg !== undefined
            ? String(exercise.target_weight_kg)
            : "",
      },
    }));
  };

  const handleCancelEditExercise = (id: string) => {
    setEditingExerciseId(null);

    setEditExerciseValues((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleSaveExerciseEdit = async (
    exercise: ProgramTemplateExercise,
    dayId: string
  ) => {
    const values = editExerciseValues[exercise.id];
    if (!values) return;

    const { data, error } = await supabase
      .from("program_template_exercises")
      .update({
        exercise_name: values.name.trim() || exercise.exercise_name,
        sets: values.sets ? Number(values.sets) : null,
        reps: values.reps || null,
        target_weight_kg: values.weight ? Number(values.weight) : null,
      })
      .eq("id", exercise.id)
      .select()
      .single();

    if (error || !data) {
      alert("Error saving exercise");
      return;
    }

    setExercisesByDay((prev) => ({
      ...prev,
      [dayId]: prev[dayId].map((e) => (e.id === exercise.id ? data : e)),
    }));

    handleCancelEditExercise(exercise.id);
  };

  return (
    <>
      <div className="mb-6 flex items-center gap-4">
        <Link href="/trainer/program-templates" className={styles.buttonSecondary}>
          ← Back
        </Link>
        <h1 className={styles.display}>
          {template?.name || "Programme Template"}
        </h1>
      </div>

      {removedExercise && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-gold bg-gold/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-ink">
            Removed {removedExercise.exercise.exercise_name ?? "exercise"}.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleUndoRemoveExercise}
              className={styles.buttonPrimary}
            >
              Undo
            </button>
            <button
              type="button"
              onClick={() => setRemovedExercise(null)}
              className={styles.buttonSecondary}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className={styles.body}>Loading template...</p>
      ) : !template ? (
        <p className={styles.body}>Template not found.</p>
      ) : (
        <div className="space-y-6">
          <div className={styles.card}>
            <h2 className={styles.subheading}>Template Details</h2>

            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="md:col-span-2">
                <label className="text-sm font-medium text-ink">
                  Template name
                </label>
                <input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className={styles.input}
                />
                </div>
                <div>
                  <label className="text-sm font-medium text-ink">
                    Duration
                  </label>
                  <select
                    value={templateDurationWeeks}
                    onChange={(e) => setTemplateDurationWeeks(e.target.value)}
                    className={styles.input}
                  >
                    {[4, 8, 12].map((weeks) => (
                      <option key={weeks} value={weeks}>
                        {weeks} weeks
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-ink">
                    Days per week
                  </label>
                  <select
                    value={templateDaysPerWeek}
                    onChange={(e) => setTemplateDaysPerWeek(e.target.value)}
                    className={styles.input}
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map((daysPerWeek) => (
                      <option key={daysPerWeek} value={daysPerWeek}>
                        {daysPerWeek} days
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-ink">
                    Workout location
                  </label>
                  <select
                    value={templateWorkoutLocation}
                    onChange={(e) => setTemplateWorkoutLocation(e.target.value)}
                    className={styles.input}
                  >
                    {workoutLocationOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handleSaveTemplateDetails}
                disabled={savingTemplate}
                className={styles.buttonPrimary}
              >
                {savingTemplate ? "Saving..." : "Save Template"}
              </button>
            </div>
          </div>

          <div className={styles.card}>
            <div className="flex flex-col gap-4 md:flex-row md:items-end">
              <div className="flex-1">
                <label className="text-sm font-medium text-ink">
                  Add new day
                </label>
                <input
                  value={newDayName}
                  onChange={(e) => setNewDayName(e.target.value)}
                  className={styles.input}
                  placeholder="e.g. Day 4 / Upper / Push"
                />
              </div>

              <button
                onClick={handleAddDay}
                disabled={addingDay}
                className={styles.buttonPrimary}
              >
                {addingDay ? "Adding..." : "Add Day"}
              </button>
            </div>
          </div>

          {sortedDays.length === 0 ? (
            <div className={styles.card}>
              <p className={styles.body}>No days added yet.</p>
            </div>
          ) : (
            sortedDays.map((day) => {
              const dayExercises = sortExercises(exercisesByDay[day.id] ?? []);
              const results = exerciseResults[day.id] ?? [];

              return (
                <div
                  key={day.id}
                  onDragOver={(event) => {
                    if (draggedDayId) {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (draggedDayId) {
                      reorderDay(draggedDayId, day.id);
                    }
                    setDraggedDayId(null);
                  }}
                  className={`${styles.card} ${
                    draggedDayId === day.id ? "border-gold bg-gold/10" : ""
                  }`}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div className="flex flex-1 items-end gap-3">
                      <button
                        type="button"
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move";
                          setDraggedDayId(day.id);
                        }}
                        onDragEnd={() => setDraggedDayId(null)}
                        aria-label={`Drag ${day.day_name ?? "day"} to reorder`}
                        className="mb-2 cursor-grab rounded-lg p-1 text-ink-muted hover:bg-surface-sunken hover:text-ink active:cursor-grabbing"
                      >
                        <GripVertical size={18} />
                      </button>

                      <div className="flex-1">
                      <label className="text-sm font-medium text-ink">
                        Day name
                      </label>
                      <input
                        value={day.day_name ?? ""}
                        onChange={(e) =>
                          setDays((prev) =>
                            prev.map((d) =>
                              d.id === day.id
                                ? { ...d, day_name: e.target.value }
                                : d
                            )
                          )
                        }
                        onBlur={(e) => handleRenameDay(day.id, e.target.value)}
                        className={styles.input}
                      />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => moveDay(day.id, "up")}
                        disabled={
                          sortedDays.findIndex((item) => item.id === day.id) ===
                            0 || reorderingDays
                        }
                        aria-label={`Move ${day.day_name ?? "day"} up`}
                        className="rounded-xl border border-border-subtle px-3 py-2 text-ink-muted hover:bg-surface-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ArrowUp size={16} />
                      </button>

                      <button
                        type="button"
                        onClick={() => moveDay(day.id, "down")}
                        disabled={
                          sortedDays.findIndex((item) => item.id === day.id) ===
                            sortedDays.length - 1 || reorderingDays
                        }
                        aria-label={`Move ${day.day_name ?? "day"} down`}
                        className="rounded-xl border border-border-subtle px-3 py-2 text-ink-muted hover:bg-surface-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ArrowDown size={16} />
                      </button>

                      <button
                        onClick={() => handleRemoveDay(day.id)}
                        className="rounded-xl border border-red-300 px-4 py-2 text-red-600 hover:bg-red-50"
                      >
                        Remove Day
                      </button>
                    </div>
                  </div>

                  {reorderingDays && (
                    <p className="mt-2 text-xs text-ink-muted">Saving day order...</p>
                  )}

                  <div className="mt-6 rounded-xl border border-slate-200 p-4">
                    <h3 className="text-sm font-semibold text-ink">
                      Add Exercise
                    </h3>

                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="text-sm font-medium text-ink">
                          Search exercise
                        </label>
                        <input
                          value={exerciseSearch[day.id] ?? ""}
                          onChange={(e) =>
                            handleSearchExercises(day.id, e.target.value)
                          }
                          className={styles.input}
                          placeholder="Type exercise, muscle, movement type, or equipment..."
                        />
                      </div>

                      {results.length > 0 && (
                        <div className="max-h-60 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-2">
                          {results.map((result) => (
                            <button
                              key={result.name}
                              type="button"
                              onClick={() =>
                                handleChooseExercise(day.id, result.name)
                              }
                              className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-left hover:bg-surface-sunken"
                            >
                              <p className="font-medium text-ink">
                                {result.name}
                              </p>
                              <p className="text-sm text-ink-muted">
                                {result.target_muscle || "—"} •{" "}
                                {result.movement_type || "—"} •{" "}
                                {result.primary_equipment || "—"}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="grid gap-4 md:grid-cols-4">
                        <div>
                          <label className="text-sm font-medium text-ink">
                            Selected exercise
                          </label>
                          <input
                            value={selectedExerciseName[day.id] ?? ""}
                            readOnly
                            className={styles.input}
                            placeholder="Choose from search above"
                          />
                        </div>

                        <div>
                          <label className="text-sm font-medium text-ink">
                            Sets
                          </label>
                          <input
                            type="number"
                            value={newExerciseSets[day.id] ?? "3"}
                            onChange={(e) =>
                              setNewExerciseSets((prev) => ({
                                ...prev,
                                [day.id]: e.target.value,
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
                            value={newExerciseReps[day.id] ?? "10"}
                            onChange={(e) =>
                              setNewExerciseReps((prev) => ({
                                ...prev,
                                [day.id]: e.target.value,
                              }))
                            }
                            className={styles.input}
                          />
                        </div>

                        <div>
                          <label className="text-sm font-medium text-ink">
                            Weight (kg)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={newExerciseWeight[day.id] ?? ""}
                            onChange={(e) =>
                              setNewExerciseWeight((prev) => ({
                                ...prev,
                                [day.id]: e.target.value,
                              }))
                            }
                            className={styles.input}
                            placeholder="Optional"
                          />
                        </div>
                      </div>

                      <button
                        onClick={() => handleAddExerciseToDay(day.id)}
                        disabled={addingExerciseForDay[day.id]}
                        className={styles.buttonPrimary}
                      >
                        {addingExerciseForDay[day.id]
                          ? "Adding..."
                          : "Add Exercise"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-ink">
                        Exercises
                      </h3>
                      {reorderingDayId === day.id && (
                        <p className="text-xs text-ink-muted">Saving order...</p>
                      )}
                    </div>

                    <div className="mt-3 space-y-2">
                      {dayExercises.length === 0 ? (
                        <p className={styles.body}>No exercises added yet.</p>
                      ) : (
dayExercises.map((exercise, index) => {
  const isEditing = editingExerciseId === exercise.id;

  const values = editExerciseValues[exercise.id] ?? {
    name: exercise.exercise_name ?? "",
    sets:
      exercise.sets !== null && exercise.sets !== undefined
        ? String(exercise.sets)
        : "",
    reps: exercise.reps ?? "",
    weight:
      exercise.target_weight_kg !== null &&
      exercise.target_weight_kg !== undefined
        ? String(exercise.target_weight_kg)
        : "",
  };

  return (
    <div
      key={exercise.id}
      draggable={!isEditing}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        setDraggedExercise({ dayId: day.id, exerciseId: exercise.id });
      }}
      onDragOver={(event) => {
        if (draggedExercise?.dayId === day.id) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        if (draggedExercise?.dayId === day.id) {
          reorderExercise(day.id, draggedExercise.exerciseId, exercise.id);
        }
        setDraggedExercise(null);
      }}
      onDragEnd={() => setDraggedExercise(null)}
      className={`flex flex-col gap-3 rounded-xl border px-4 py-3 transition ${
        draggedExercise?.exerciseId === exercise.id
          ? "border-gold bg-gold/10 opacity-70"
          : "border-slate-200 bg-surface-raised"
      }`}
    >
      {!isEditing ? (
        // 🔹 NORMAL VIEW
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <button
              type="button"
              aria-label={`Drag ${exercise.exercise_name ?? "exercise"} to reorder`}
              className="mt-1 cursor-grab rounded-lg p-1 text-ink-muted hover:bg-surface-sunken hover:text-ink active:cursor-grabbing"
            >
              <GripVertical size={18} />
            </button>
            <div className="min-w-0">
            <p className="font-medium text-ink">
              {exercise.exercise_name}
            </p>
            <p className="text-sm text-ink-muted">
              {exercise.sets ?? "-"} sets • {exercise.reps ?? "-"} reps
              {exercise.target_weight_kg !== null &&
              exercise.target_weight_kg !== undefined
                ? ` • ${exercise.target_weight_kg} kg`
                : ""}
            </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => moveExercise(day.id, exercise.id, "up")}
              disabled={index === 0 || reorderingDayId === day.id}
              aria-label={`Move ${exercise.exercise_name ?? "exercise"} up`}
              className="rounded-xl border border-border-subtle px-3 py-2 text-ink-muted hover:bg-surface-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowUp size={16} />
            </button>

            <button
              type="button"
              onClick={() => moveExercise(day.id, exercise.id, "down")}
              disabled={
                index === dayExercises.length - 1 || reorderingDayId === day.id
              }
              aria-label={`Move ${exercise.exercise_name ?? "exercise"} down`}
              className="rounded-xl border border-border-subtle px-3 py-2 text-ink-muted hover:bg-surface-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowDown size={16} />
            </button>

            <button
              onClick={() => handleStartEditExercise(exercise)}
              className={styles.buttonSecondary}
            >
              Edit
            </button>

            <button
              onClick={() =>
                handleRemoveExercise(exercise.id, day.id)
              }
              className="rounded-xl border border-red-300 px-4 py-2 text-red-600 hover:bg-red-50"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        // 🔹 EDIT MODE
        <div className="space-y-4">
          <div>
            <p className="font-medium text-ink">
              {exercise.exercise_name}
            </p>
            <p className="text-sm text-ink-muted">
              Edit exercise
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-3">
              <label className="text-sm font-medium text-ink">
                Exercise
              </label>
              <input
                value={values.name}
                onChange={(e) =>
                  setEditExerciseValues((prev) => ({
                    ...prev,
                    [exercise.id]: {
                      ...values,
                      name: e.target.value,
                    },
                  }))
                }
                className={styles.input}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-ink">
                Sets
              </label>
              <input
                type="number"
                value={values.sets}
                onChange={(e) =>
                  setEditExerciseValues((prev) => ({
                    ...prev,
                    [exercise.id]: {
                      ...values,
                      sets: e.target.value,
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
                value={values.reps}
                onChange={(e) =>
                  setEditExerciseValues((prev) => ({
                    ...prev,
                    [exercise.id]: {
                      ...values,
                      reps: e.target.value,
                    },
                  }))
                }
                className={styles.input}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-ink">
                Weight (kg)
              </label>
              <input
                type="number"
                step="0.1"
                value={values.weight}
                onChange={(e) =>
                  setEditExerciseValues((prev) => ({
                    ...prev,
                    [exercise.id]: {
                      ...values,
                      weight: e.target.value,
                    },
                  }))
                }
                className={styles.input}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() =>
                handleSaveExerciseEdit(exercise, day.id)
              }
              className={styles.buttonPrimary}
            >
              Save
            </button>

            <button
              onClick={() => handleCancelEditExercise(exercise.id)}
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
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </>
  );
}
