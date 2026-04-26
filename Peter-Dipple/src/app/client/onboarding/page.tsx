"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";
import PageHeader from "@/components/PageHeader";

type Client = {
  id: string;
  profile_id: string | null;
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

function locationLabel(value: string) {
  if (value === "gym") return "Gym";
  if (value === "home_weights") return "Home weights";
  if (value === "home_bodyweight") return "Home bodyweight";
  return value;
}

export default function ClientOnboardingPage() {
  const router = useRouter();

  const [client, setClient] = useState<Client | null>(null);
  const [templates, setTemplates] = useState<ProgramTemplate[]>([]);

  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [sex, setSex] = useState("");
  const [trainingDays, setTrainingDays] = useState("");
  const [activityLevel, setActivityLevel] = useState("");
  const [workoutLocation, setWorkoutLocation] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const availableDays = useMemo(() => {
    return Array.from(
      new Set(
        templates
          .map((template) => template.days_per_week)
          .filter((value): value is number => value !== null)
      )
    ).sort((a, b) => a - b);
  }, [templates]);

  const availableLocations = useMemo(() => {
    if (!trainingDays) return [];

    return Array.from(
      new Set(
        templates
          .filter((template) => template.days_per_week === Number(trainingDays))
          .map((template) => template.workout_location)
          .filter((value): value is string => Boolean(value))
      )
    );
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
        .select("id, profile_id")
        .eq("profile_id", user.id)
        .single();

      if (!clientData) {
        setLoading(false);
        return;
      }

      setClient(clientData);

      const { data: templateData } = await supabase
        .from("program_templates")
        .select("id, name, days_per_week, duration_weeks, workout_location")
        .not("days_per_week", "is", null)
        .not("workout_location", "is", null)
        .order("days_per_week", { ascending: true })
        .order("name", { ascending: true });

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

      const exerciseRows = ((templateExercises ?? []) as TemplateExercise[]).map(
        (exercise) => ({
          client_program_day_id: clientDay.id,
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
      !trainingDays ||
      !activityLevel ||
      !workoutLocation ||
      !selectedTemplate
    ) {
      alert("Please complete all onboarding questions.");
      return;
    }

    setSubmitting(true);

    const { error: clientUpdateError } = await supabase
      .from("clients")
      .update({
        full_name: fullName.trim(),
        date_of_birth: dateOfBirth,
        sex,
        training_days_per_week: Number(trainingDays),
        activity_level: activityLevel,
        workout_location: workoutLocation,
        onboarding_complete: true,
      })
      .eq("id", client.id);

    if (clientUpdateError) {
      alert("Could not save onboarding answers.");
      setSubmitting(false);
      return;
    }

    try {
      await assignTemplateToClient(client.id, selectedTemplate.id);
    } catch (error) {
      alert("Answers saved, but programme assignment failed.");
      setSubmitting(false);
      return;
    }

    router.replace("/client/dashboard");
  };

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <PageHeader title="Welcome" />

        {loading ? (
          <p className={styles.body}>Loading onboarding...</p>
        ) : !client ? (
          <p className={styles.body}>Client not found.</p>
        ) : (
          <div className="space-y-6">
            <div className={styles.card}>
              <h2 className={styles.subheading}>Let’s get you set up</h2>
              <p className="mt-2 text-sm text-[#2B2B2B]">
                Answer these quick questions so we can assign the right starting programme.
              </p>
            </div>

            <div className={styles.card}>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-[#111111]">Name</label>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={styles.input}
                    placeholder="Your full name"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-[#111111]">Date of birth</label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className={styles.input}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-[#111111]">Sex</label>
                  <select value={sex} onChange={(e) => setSex(e.target.value)} className={styles.input}>
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-[#111111]">Current activity level</label>
                  <select
                    value={activityLevel}
                    onChange={(e) => setActivityLevel(e.target.value)}
                    className={styles.input}
                  >
                    <option value="">Select</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-[#111111]">
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
                      <option key={day} value={day}>
                        {day} days
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-[#111111]">
                    What are your workout plans?
                  </label>
                  <select
                    value={workoutLocation}
                    onChange={(e) => setWorkoutLocation(e.target.value)}
                    className={styles.input}
                    disabled={!trainingDays}
                  >
                    <option value="">Select</option>
                    {availableLocations.map((location) => (
                      <option key={location} value={location}>
                        {locationLabel(location)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedTemplate && (
                <div className="mt-4 rounded-xl bg-[#F2F2F2] p-4">
                  <p className="text-sm text-[#2B2B2B]">Programme selected</p>
                  <p className="mt-1 font-semibold text-[#111111]">
                    {selectedTemplate.name}
                  </p>
                </div>
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