"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";

const canonicalMovementTypes = [
  "Full body",
  "Lower body",
  "Upper body",
  "Upper pull",
  "Upper push",
];

const normaliseMovementType = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const canonical = canonicalMovementTypes.find(
    (movementType) => movementType.toLowerCase() === trimmed.toLowerCase()
  );

  return canonical ?? trimmed;
};

type ExerciseForm = {
  name: string;
  youtube_short: string;
  rest: string;
  target_muscle: string;
  movement_type: string;
  primary_equipment: string;
  alternate: string;
};

type ExerciseSearchResult = {
  name: string;
  target_muscle: string | null;
  movement_type: string | null;
  primary_equipment: string | null;
};

const emptyForm: ExerciseForm = {
  name: "",
  youtube_short: "",
  rest: "",
  target_muscle: "",
  movement_type: "",
  primary_equipment: "",
  alternate: "",
};

const cleanText = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export default function NewExercisePage() {
  const [form, setForm] = useState<ExerciseForm>(emptyForm);
  const [movementTypes, setMovementTypes] = useState(canonicalMovementTypes);
  const [alternateResults, setAlternateResults] = useState<ExerciseSearchResult[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    const loadMovementTypes = async () => {
      const { data } = await supabase
        .from("exercises")
        .select("movement_type")
        .not("movement_type", "is", null);

      const existingTypes = Array.from(
        new Set(
          (data ?? [])
            .map((row) => row.movement_type as string | null)
            .map(normaliseMovementType)
            .filter((value): value is string => Boolean(value))
        )
      );

      setMovementTypes(
        Array.from(new Set([...canonicalMovementTypes, ...existingTypes])).sort(
          (a, b) =>
            canonicalMovementTypes.indexOf(a) - canonicalMovementTypes.indexOf(b) ||
            a.localeCompare(b)
        )
      );
    };

    loadMovementTypes();
  }, []);

  const restValue = useMemo(() => {
    if (form.rest.trim() === "") return null;
    const parsed = Number(form.rest);
    return Number.isFinite(parsed) ? parsed : null;
  }, [form.rest]);

  const updateField = (field: keyof ExerciseForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSearchAlternates = async (search: string) => {
    updateField("alternate", search);

    if (!search.trim()) {
      setAlternateResults([]);
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
      setAlternateResults([]);
      return;
    }

    const currentName = form.name.trim().toLowerCase();
    setAlternateResults(
      (data as ExerciseSearchResult[]).filter(
        (exercise) => exercise.name.trim().toLowerCase() !== currentName
      )
    );
  };

  const handleChooseAlternate = (name: string) => {
    updateField("alternate", name);
    setAlternateResults([]);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    if (form.rest.trim() !== "" && restValue === null) {
      setMessage({ type: "error", text: "Rest must be a number of seconds." });
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("exercises").insert({
      name: cleanText(form.name),
      youtube_short: cleanText(form.youtube_short),
      rest: restValue,
      target_muscle: cleanText(form.target_muscle),
      movement_type: normaliseMovementType(form.movement_type),
      primary_equipment: cleanText(form.primary_equipment),
      alternate: cleanText(form.alternate),
    });

    if (error) {
      setMessage({ type: "error", text: `Exercise could not be saved: ${error.message}` });
      setSaving(false);
      return;
    }

    setForm(emptyForm);
    setAlternateResults([]);
    setMessage({ type: "success", text: "Exercise saved." });
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className={styles.label}>Exercise library</p>
          <h1 className={`${styles.display} mt-2`}>Add Exercise</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Add a single exercise to the shared library without importing a CSV.
          </p>
        </div>
        <Link href="/trainer/program-templates" className={styles.buttonSecondary}>
          Back to programmes
        </Link>
      </div>

      {message && (
        <div
          className={`rounded-md p-3 text-sm font-medium ${
            message.type === "success"
              ? "bg-emerald/10 text-emerald"
              : "bg-red-100 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className={`${styles.card} space-y-5`}>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-ink">Name</label>
            <input
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              className={styles.input}
              placeholder="e.g. Goblet squat"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-ink">YouTube short</label>
            <input
              value={form.youtube_short}
              onChange={(event) => updateField("youtube_short", event.target.value)}
              className={styles.input}
              placeholder="https://youtube.com/shorts/..."
            />
          </div>

          <div>
            <label className="text-sm font-medium text-ink">Rest seconds</label>
            <input
              type="number"
              step="1"
              min="0"
              value={form.rest}
              onChange={(event) => updateField("rest", event.target.value)}
              className={styles.input}
              placeholder="e.g. 60"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-ink">Target muscle</label>
            <input
              value={form.target_muscle}
              onChange={(event) => updateField("target_muscle", event.target.value)}
              className={styles.input}
              placeholder="e.g. Quads"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-ink">Movement type</label>
            <select
              value={form.movement_type}
              onChange={(event) => updateField("movement_type", event.target.value)}
              className={styles.select}
            >
              <option value="">Select movement type</option>
              {movementTypes.map((movementType) => (
                <option key={movementType} value={movementType}>
                  {movementType}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-ink">Primary equipment</label>
            <input
              value={form.primary_equipment}
              onChange={(event) => updateField("primary_equipment", event.target.value)}
              className={styles.input}
              placeholder="e.g. Dumbbells"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium text-ink">Alternate</label>
            <input
              value={form.alternate}
              onChange={(event) => handleSearchAlternates(event.target.value)}
              className={styles.input}
              placeholder="Search existing exercises..."
            />
            {alternateResults.length > 0 && (
              <div className="mt-2 max-h-60 space-y-2 overflow-y-auto rounded-md border border-border-subtle bg-surface-raised p-2">
                {alternateResults.map((exercise) => (
                  <button
                    key={exercise.name}
                    type="button"
                    onClick={() => handleChooseAlternate(exercise.name)}
                    className="block w-full rounded-md border border-border-subtle px-3 py-2 text-left transition hover:bg-surface-sunken"
                  >
                    <p className="font-medium text-ink">{exercise.name}</p>
                    <p className="text-sm text-ink-muted">
                      {exercise.target_muscle || "-"} -{" "}
                      {exercise.movement_type || "-"} -{" "}
                      {exercise.primary_equipment || "-"}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className={styles.buttonPrimary}
          >
            {saving ? "Saving..." : "Save exercise"}
          </button>
        </div>
      </form>
    </div>
  );
}
