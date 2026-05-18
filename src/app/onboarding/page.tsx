"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";
import { lookupExerciseIdsByName, getExerciseIdForName } from "@/lib/exerciseLinking";
import { hasAcceptedCurrentLegal } from "@/lib/legal";
import { getMondayOf } from "@/lib/dates";

type Client = {
  id: string;
  profile_id: string | null;
  terms_accepted_at?: string | null;
  privacy_accepted_at?: string | null;
  health_data_consent_at?: string | null;
  terms_version?: string | null;
  privacy_version?: string | null;
};

type ProgramTemplate = {
  id: string;
  name: string;
  days_per_week: number | null;
  duration_weeks: number | null;
  workout_location: string | null;
};

type TemplateDay = {
  id: string;
  day_name: string | null;
  sort_order: number | null;
};

type TemplateExercise = {
  id: string;
  program_template_day_id: string;
  exercise_name: string | null;
  sets: number | null;
  reps: string | null;
  target_weight_kg: number | null;
  sort_order: number | null;
};

const ratingFields = [
  { key: "energy_level", label: "Energy" },
  { key: "hunger_level", label: "Hunger" },
  { key: "motivation_level", label: "Motivation" },
  { key: "soreness_level", label: "Soreness" },
  { key: "sleep_quality", label: "Sleep" },
] as const;

type RatingKey = (typeof ratingFields)[number]["key"];

type Ratings = Record<RatingKey, string>;
type Sex = "male" | "female";

const emptyRatings: Ratings = {
  energy_level: "",
  hunger_level: "",
  motivation_level: "",
  soreness_level: "",
  sleep_quality: "",
};

const FALLBACK_DAYS = [3, 4, 5];

const FALLBACK_LOCATIONS_BY_DAYS: Record<string, string[]> = {
  "3": ["gym", "home_weights"],
  "4": ["gym", "home_weights"],
  "5": ["gym", "home_weights"],
};

function getWorkoutLocationLabel(location: string) {
  if (location === "gym") return "Gym";
  if (location === "home_weights") return "Home - Dumbbells";
  return location;
}

function getAge(dateOfBirth: string) {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age;
}

function calculateBmr({
  sex,
  weightKg,
  heightCm,
  age,
}: {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  age: number;
}) {
  if (sex === "male") {
    return 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age;
  }

  if (sex === "female") {
    return 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.33 * age;
  }

  // This should be unreachable because onboarding only offers male/female.
  // Keep a conservative fallback so a future option cannot silently use the male equation.
  return 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.33 * age;
}

function getActivityFactor(activityLevel: string) {
  const factors: Record<string, number> = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    very_active: 1.725,
    extra_active: 1.9,
  };

  return factors[activityLevel] ?? 1.2;
}

function roundToNearest250(value: number) {
  return Math.round(value / 250) * 250;
}

export default function ClientOnboardingPage() {
  const router = useRouter();

  const [client, setClient] = useState<Client | null>(null);
  const [templates, setTemplates] = useState<ProgramTemplate[]>([]);

  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [sex, setSex] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [trainingDays, setTrainingDays] = useState("");
  const [activityLevel, setActivityLevel] = useState("");
  const [workoutLocation, setWorkoutLocation] = useState("");
  const [ratings, setRatings] = useState<Ratings>(emptyRatings);
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [sideFile, setSideFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const availableDays = useMemo(() => {
    const daysFromTemplates = Array.from(
      new Set(
        templates
          .map((template) => template.days_per_week)
          .filter((value): value is number => value !== null)
      )
    ).sort((a, b) => a - b);

    return daysFromTemplates.length > 0 ? daysFromTemplates : FALLBACK_DAYS;
  }, [templates]);

  const availableLocations = useMemo(() => {
    if (!trainingDays) return [];

    const locationsFromTemplates = Array.from(
      new Set(
        templates
          .filter((template) => template.days_per_week === Number(trainingDays))
          .map((template) => template.workout_location)
          .filter((value): value is string => Boolean(value))
      )
    );

    if (locationsFromTemplates.length > 0) {
      return locationsFromTemplates;
    }

    return FALLBACK_LOCATIONS_BY_DAYS[trainingDays] ?? [];
  }, [templates, trainingDays]);

  const selectedTemplate = useMemo(() => {
    if (!trainingDays || !workoutLocation) return null;

    return (
      templates.find(
        (template) =>
          template.days_per_week === Number(trainingDays) &&
          template.workout_location === workoutLocation &&
          template.duration_weeks === 12
      ) ??
      templates.find(
        (template) =>
          template.days_per_week === Number(trainingDays) &&
          template.workout_location === workoutLocation
      ) ??
      null
    );
  }, [templates, trainingDays, workoutLocation]);

  useEffect(() => {
    const loadPage = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: clientData } = await supabase
        .from("clients")
        .select("id, profile_id, terms_accepted_at, privacy_accepted_at, health_data_consent_at, terms_version, privacy_version")
        .eq("profile_id", user.id)
        .single();

      if (!clientData) {
        setLoading(false);
        return;
      }

      if (!hasAcceptedCurrentLegal(clientData)) {
        router.replace("/client/terms");
        return;
      }

      setClient(clientData);

      const { data: templateData, error: templateError } = await supabase
        .from("program_templates")
        .select("id, name, days_per_week, duration_weeks, workout_location")
        .not("days_per_week", "is", null)
        .not("workout_location", "is", null)
        .order("days_per_week", { ascending: true })
        .order("name", { ascending: true });

      if (templateError) {
        console.error("Could not load programme templates:", templateError);
      }

      setTemplates(templateData ?? []);
      setLoading(false);
    };

    loadPage();
  }, [router]);

  const assignTemplateToClient = async (clientId: string, templateId: string) => {
    const { data: newProgram, error: programError } = await supabase
      .from("client_programs")
      .insert([
        {
          client_id: clientId,
          program_template_id: templateId,
          current_day_index: 0,
          status: "active",
        },
      ])
      .select()
      .single();

    if (programError || !newProgram) {
      throw new Error("Could not assign programme");
    }

    const { data: templateDays, error: daysError } = await supabase
      .from("program_template_days")
      .select("*")
      .eq("program_template_id", templateId)
      .order("sort_order", { ascending: true });

    if (daysError) throw new Error("Could not load template days");

    for (const templateDay of (templateDays ?? []) as TemplateDay[]) {
      const { data: clientDay, error: clientDayError } = await supabase
        .from("client_program_days")
        .insert([
          {
            client_program_id: newProgram.id,
            day_name: templateDay.day_name,
            sort_order: templateDay.sort_order,
            completed: false,
          },
        ])
        .select()
        .single();

      if (clientDayError || !clientDay) {
        throw new Error("Could not create client programme day");
      }

      const { data: templateExercises, error: exercisesError } = await supabase
        .from("program_template_exercises")
        .select("*")
        .eq("program_template_day_id", templateDay.id)
        .order("sort_order", { ascending: true });

      if (exercisesError) throw new Error("Could not load template exercises");

// Look up exercise_id for each name so we get videos, rest timer, alternates etc.
const exerciseIdMap = await lookupExerciseIdsByName(
  ((templateExercises ?? []) as TemplateExercise[]).map((e) => e.exercise_name)
);

const exerciseRows = ((templateExercises ?? []) as TemplateExercise[]).map(
  (exercise) => ({
    client_program_day_id: clientDay.id,
    exercise_id: getExerciseIdForName(exerciseIdMap, exercise.exercise_name),
    exercise_name: exercise.exercise_name,
    sets: exercise.sets,
    reps: exercise.reps,
    target_weight_kg: exercise.target_weight_kg,
    sort_order: exercise.sort_order,
  })
);

      if (exerciseRows.length > 0) {
        const { error: insertExerciseError } = await supabase
          .from("client_program_day_exercises")
          .insert(exerciseRows);

        if (insertExerciseError) {
          throw new Error("Could not create client programme exercises");
        }
      }
    }
  };

  const handleSubmit = async () => {
    if (!client) return;

    if (
      !fullName.trim() ||
      !dateOfBirth ||
      !sex ||
      !heightCm ||
      !weightKg ||
      !trainingDays ||
      !activityLevel ||
      !workoutLocation ||
      !ratingFields.every((field) => ratings[field.key]) ||
      !frontFile ||
      !backFile ||
      !sideFile
    ) {
      alert("Please complete all onboarding questions.");
      return;
    }

    if (!selectedTemplate) {
      alert(
        "No matching programme template was found for that selection. Please check programme templates."
      );
      return;
    }

    const heightNumber = Number(heightCm);
    const weightNumber = Number(weightKg);
    const age = getAge(dateOfBirth);

    if (!heightNumber || !weightNumber || age <= 0) {
      alert("Please check your height, weight, and date of birth.");
      return;
    }

    const bmr = calculateBmr({
      sex: sex as Sex,
      weightKg: weightNumber,
      heightCm: heightNumber,
      age,
    });

    const tdee = bmr * getActivityFactor(activityLevel);
    const calorieTarget = roundToNearest250(tdee);

    setSubmitting(true);
    const today = new Date().toISOString().split("T")[0];
    const weekStart = getMondayOf(today);

    try {
      const uploads: Array<{ type: "front" | "back" | "side"; file: File }> = [
        { type: "front", file: frontFile },
        { type: "back", file: backFile },
        { type: "side", file: sideFile },
      ];

      for (const { type, file } of uploads) {
        const fileExt = file.name.split(".").pop();
        const filePath = `${client.id}/${today}-${type}-onboarding-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("progress-photos")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { error: photoError } = await supabase.from("progress_photos").insert({
          client_id: client.id,
          image_url: filePath,
          storage_path: filePath,
          log_date: today,
          photo_type: type,
          note: "Initial progress photos (onboarding)",
        });

        if (photoError) throw photoError;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      alert(`Could not upload onboarding photos: ${message}`);
      setSubmitting(false);
      return;
    }

    const { error: clientUpdateError } = await supabase
      .from("clients")
      .update({
        full_name: fullName.trim(),
        date_of_birth: dateOfBirth,
        sex,
        height_cm: heightNumber,
        weight_kg: weightNumber,
        training_days_per_week: Number(trainingDays),
        activity_level: activityLevel,
        workout_location: workoutLocation,
        bmr_estimate: Math.round(bmr),
        tdee_estimate: Math.round(tdee),
        calorie_target: calorieTarget,
        onboarding_complete: true,
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq("id", client.id);

    if (clientUpdateError) {
      alert("Could not save onboarding answers.");
      setSubmitting(false);
      return;
    }
// Record the onboarding weight as the first entry in the weight log timeline
// so it appears on stats graphs.
await supabase.from("client_weight_logs").insert([
  {
    client_id: client.id,
    weight_kg: weightNumber,
    log_date: today,
    note: "Initial weight (onboarding)",
  },
]);

const { error: baselineCheckInError } = await supabase.from("client_weekly_check_ins").upsert(
  {
    client_id: client.id,
    week_start: weekStart,
    weight_kg: weightNumber,
    photos_uploaded: true,
    energy_level: Number(ratings.energy_level),
    hunger_level: Number(ratings.hunger_level),
    motivation_level: Number(ratings.motivation_level),
    soreness_level: Number(ratings.soreness_level),
    sleep_quality: Number(ratings.sleep_quality),
    notes: "Initial check-in values from onboarding",
    submitted_at: new Date().toISOString(),
  },
  { onConflict: "client_id,week_start" }
);

if (baselineCheckInError) {
  alert("Could not save starting check-in values.");
  setSubmitting(false);
  return;
}

    try {
      await assignTemplateToClient(client.id, selectedTemplate.id);
    } catch {
      alert("Answers saved, but programme assignment failed.");
      setSubmitting(false);
      return;
    }

    router.replace("/client/dashboard");
  };

  return (
    <main className="min-h-screen bg-surface-base p-6">
      <div className="mx-auto max-w-3xl">
        <h1 className={`${styles.display} mb-6 text-center`}>Welcome!</h1>

        {loading ? (
          <p className={styles.body}>Loading onboarding...</p>
        ) : !client ? (
          <p className={styles.body}>Client not found.</p>
        ) : (
          <div className="space-y-6">
            <div className={styles.card}>
              <h2 className={styles.subheading}>Let’s get you set up</h2>
              <p className="mt-2 text-sm text-ink-muted">
                Answer these quick questions so we can assign the right starting
                programme.
              </p>
            </div>

            <div className={styles.card}>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-ink">Name</label>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={styles.input}
                    placeholder="Your full name"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-ink">Sex</label>
                  <select
                    value={sex}
                    onChange={(e) => setSex(e.target.value)}
                    className={styles.input}
                  >
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-ink">
                    Height (cm)
                  </label>
                  <input
                    type="number"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    className={styles.input}
                    placeholder="e.g. 178"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-ink">
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    className={styles.input}
                    placeholder="e.g. 82.5"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-ink">
                    Date of birth
                  </label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className={styles.input}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-ink">
                    Current activity level
                  </label>
                  <select
                    value={activityLevel}
                    onChange={(e) => setActivityLevel(e.target.value)}
                    className={styles.input}
                  >
                    <option value="">Select</option>
                    <option value="sedentary">
                      Sedentary: Little/no exercise
                    </option>
                    <option value="lightly_active">
                      Lightly active: 1-3 days/week
                    </option>
                    <option value="moderately_active">
                      Moderately active: 3-5 days/week
                    </option>
                    <option value="very_active">
                      Very active: 6-7 days/week
                    </option>
                    <option value="extra_active">
                      Extra active: Physical job + training
                    </option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-ink">
                    How many days per week will you work out?
                  </label>
                  <select
                    value={trainingDays}
                    onChange={(e) => {
                      setTrainingDays(e.target.value);
                      setWorkoutLocation("");
                    }}
                    className={styles.input}
                  >
                    <option value="">Select</option>
                    {availableDays.map((day) => (
                      <option key={day} value={String(day)}>
                        {day} days
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-ink">
                    What are your workout plans?
                  </label>
                  <select
                    value={workoutLocation}
                    onChange={(e) => setWorkoutLocation(e.target.value)}
                    className={styles.input}
                    disabled={!trainingDays}
                  >
                    <option value="">
                      {trainingDays ? "Select" : "Choose days first"}
                    </option>
                    {availableLocations.map((location) => (
                      <option key={location} value={location}>
                        {getWorkoutLocationLabel(location)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-6 border-t border-border-subtle pt-6">
                <h3 className="font-semibold text-ink">Starting check-in values</h3>
                <p className="mt-1 text-sm text-ink-muted">
                  Score each area from 1 low to 5 high so Peter has a baseline.
                </p>

                <div className="mt-4 grid gap-4 md:grid-cols-5">
                  {ratingFields.map((field) => (
                    <div key={field.key}>
                      <label className="text-sm font-medium text-ink">
                        {field.label}
                      </label>
                      <select
                        value={ratings[field.key]}
                        onChange={(event) =>
                          setRatings((prev) => ({
                            ...prev,
                            [field.key]: event.target.value,
                          }))
                        }
                        className={styles.input}
                      >
                        <option value="">Select</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                        <option value="5">5</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 border-t border-border-subtle pt-6">
                <h3 className="font-semibold text-ink">Starting progress photos</h3>
                <p className="mt-1 text-sm text-ink-muted">
                  Upload front, back and side photos so Peter has a starting
                  point for your coaching journey.
                </p>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="text-sm font-medium text-ink">
                      Front photo
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) =>
                        setFrontFile(event.target.files?.[0] ?? null)
                      }
                      className={`${styles.input} pt-2`}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-ink">
                      Back photo
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) =>
                        setBackFile(event.target.files?.[0] ?? null)
                      }
                      className={`${styles.input} pt-2`}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-ink">
                      Side photo
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) =>
                        setSideFile(event.target.files?.[0] ?? null)
                      }
                      className={`${styles.input} pt-2`}
                    />
                  </div>
                </div>
              </div>

              {trainingDays && availableLocations.length === 0 && (
                <p className="mt-4 text-sm text-red-600">
                  No workout locations found for {trainingDays} days. Check your
                  programme templates.
                </p>
              )}

              {trainingDays && workoutLocation && !selectedTemplate && (
                <p className="mt-4 text-sm text-red-600">
                  No matching programme template found for this selection.
                </p>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className={`${styles.buttonPrimary} mt-6 w-full py-3 disabled:opacity-50`}
              >
                {submitting ? "Setting up..." : "Complete Setup"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
