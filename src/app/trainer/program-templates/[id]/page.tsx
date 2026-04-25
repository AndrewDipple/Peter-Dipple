"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/PageHeader";
import { styles } from "@/lib/design";

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
  difficulty: string | null;
  target_muscle: string | null;
  primary_equipment: string | null;
};

export default function ProgramTemplateDetailPage({ params }: PageProps) {
  const [templateId, setTemplateId] = useState("");
  const [template, setTemplate] = useState<ProgramTemplate | null>(null);
  const [templateName, setTemplateName] = useState("");
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

  const sortedDays = useMemo(() => {
    return [...days].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [days]);

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
      setDays([]);
      setExercisesByDay({});
      setLoading(false);
      return;
    }

    setTemplate(templateData);
    setTemplateName(templateData.name ?? "");

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
    loadPage();
  }, [params]);

  const handleSaveTemplateName = async () => {
    if (!templateId || !templateName.trim()) {
      alert("Please enter a template name");
      return;
    }

    setSavingTemplate(true);

    const { error } = await supabase
      .from("program_templates")
      .update({ name: templateName.trim() })
      .eq("id", templateId);

    if (error) {
      alert("Error saving template");
      setSavingTemplate(false);
      return;
    }

    setTemplate((prev) =>
      prev ? { ...prev, name: templateName.trim() } : prev
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
      prev.map((day) => (day.id === dayId ? { ...day, day_name: dayName } : day))
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

    const q = search.trim();

    const { data, error } = await supabase
      .from("exercises")
      .select("name, difficulty, target_muscle, primary_equipment")
      .or(
        `name.ilike.%${q}%,target_muscle.ilike.%${q}%,primary_equipment.ilike.%${q}%,difficulty.ilike.%${q}%`
      )
      .order("name", { ascending: true })
      .limit(20);

    if (error || !data) {
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
      [dayId]: (prev[dayId] ?? []).filter((exercise) => exercise.id !== exerciseId),
    }));
  };

  return (
    <main className={styles.page}>
      <div className="mx-auto max-w-6xl rounded-2xl bg-white p-6 shadow">
        <PageHeader
          title={template?.name || "Programme Template"}
          backHref="/trainer/program-templates"
          showTrainerNav
        />

        {loading ? (
          <p className={styles.body}>Loading template...</p>
        ) : !template ? (
          <p className={styles.body}>Template not found.</p>
        ) : (
          <div className="space-y-6">
            <div className={styles.card}>
              <h2 className={styles.subheading}>Template Details</h2>

              <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                <div>
                  <label className="text-sm font-medium text-[#111111]">
                    Template name
                  </label>
                  <input
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className={styles.input}
                  />
                  <p className="mt-2 text-sm text-[#2B2B2B]">
                    {template.duration_weeks ?? "-"} weeks •{" "}
                    {template.days_per_week ?? "-"} days per week
                  </p>
                </div>

                <button
                  onClick={handleSaveTemplateName}
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
                  <label className="text-sm font-medium text-[#111111]">
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
                const dayExercises = exercisesByDay[day.id] ?? [];
                const results = exerciseResults[day.id] ?? [];

                return (
                  <div key={day.id} className={styles.card}>
                    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                      <div className="flex-1">
                        <label className="text-sm font-medium text-[#111111]">
                          Day name
                        </label>
                        <input
                          value={day.day_name ?? ""}
                          onChange={(e) =>
                            setDays((prev) =>
                              prev.map((d) =>
                                d.id === day.id ? { ...d, day_name: e.target.value } : d
                              )
                            )
                          }
                          onBlur={(e) => handleRenameDay(day.id, e.target.value)}
                          className={styles.input}
                        />
                      </div>

                      <button
                        onClick={() => handleRemoveDay(day.id)}
                        className="rounded-xl border border-red-300 px-4 py-2 text-red-600 hover:bg-red-50"
                      >
                        Remove Day
                      </button>
                    </div>

                    <div className="mt-6 rounded-xl border border-slate-200 p-4">
                      <h3 className="text-sm font-semibold text-[#111111]">
                        Add Exercise
                      </h3>

                      <div className="mt-4 space-y-4">
                        <div>
                          <label className="text-sm font-medium text-[#111111]">
                            Search exercise
                          </label>
                          <input
                            value={exerciseSearch[day.id] ?? ""}
                            onChange={(e) =>
                              handleSearchExercises(day.id, e.target.value)
                            }
                            className={styles.input}
                            placeholder="Type exercise, muscle, equipment, or difficulty..."
                          />
                        </div>

                        {results.length > 0 && (
                          <div className="max-h-60 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-2">
                            {results.map((result) => (
                              <button
                                key={result.name}
                                type="button"
                                onClick={() => handleChooseExercise(day.id, result.name)}
                                className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-left hover:bg-[#F2F2F2]"
                              >
                                <p className="font-medium text-[#111111]">
                                  {result.name}
                                </p>
                                <p className="text-sm text-[#2B2B2B]">
                                  {result.target_muscle || "—"} •{" "}
                                  {result.primary_equipment || "—"} •{" "}
                                  {result.difficulty || "—"}
                                </p>
                              </button>
                            ))}
                          </div>
                        )}

                        <div className="grid gap-4 md:grid-cols-4">
                          <div>
                            <label className="text-sm font-medium text-[#111111]">
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
                            <label className="text-sm font-medium text-[#111111]">
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
                            <label className="text-sm font-medium text-[#111111]">
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
                            <label className="text-sm font-medium text-[#111111]">
                              Target weight (kg)
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
                          {addingExerciseForDay[day.id] ? "Adding..." : "Add Exercise"}
                        </button>
                      </div>
                    </div>

                    <div className="mt-6">
                      <h3 className="text-sm font-semibold text-[#111111]">
                        Exercises
                      </h3>

                      <div className="mt-3 space-y-2">
                        {dayExercises.length === 0 ? (
                          <p className={styles.body}>No exercises added yet.</p>
                        ) : (
                          dayExercises.map((exercise) => (
                            <div
                              key={exercise.id}
                              className="flex flex-col gap-3 rounded-xl border border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between"
                            >
                              <div>
                                <p className="font-medium text-[#111111]">
                                  {exercise.exercise_name}
                                </p>
                                <p className="text-sm text-[#2B2B2B]">
                                  {exercise.sets ?? "-"} sets • {exercise.reps ?? "-"} reps
                                  {exercise.target_weight_kg !== null &&
                                  exercise.target_weight_kg !== undefined
                                    ? ` • ${exercise.target_weight_kg} kg`
                                    : ""}
                                </p>
                              </div>

                              <button
                                onClick={() =>
                                  handleRemoveExercise(exercise.id, day.id)
                                }
                                className="rounded-xl border border-red-300 px-4 py-2 text-red-600 hover:bg-red-50"
                              >
                                Remove
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </main>
  );
}