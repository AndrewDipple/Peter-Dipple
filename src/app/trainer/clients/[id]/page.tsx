"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { notifyProgramAssigned } from "@/components/notifications";
import { styles } from "@/lib/design";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Client = {
  id: string;
  full_name: string;
  email: string;
  calorie_target: number | null;
  protein_g: number | null;
  date_of_birth: string | null;
  sex: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  training_days_per_week: number | null;
  activity_level: string | null;
  workout_location: string | null;
  bmr_estimate: number | null;
  tdee_estimate: number | null;
  onboarding_complete: boolean | null;
  daily_step_target: number;
};

type MealLog = {
  id: string;
  recipe_id: string;
  completed: boolean;
  quantity: number | null;
  recipes: {
    name: string;
    calories: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
  } | null;
};

type CustomMealLog = {
  id: string;
  meal_name: string;
  calories: number;
  log_date: string;
  note: string | null;
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
  client_program_id: string | null;
  client_program_day_id: string;
  client_program_day_exercise_id: string;
  set_number: number;
  actual_weight_kg: number | null;
  actual_reps: number | null;
  completed: boolean;
  created_at: string;
};

type ProgramTemplate = {
  id: string;
  name: string;
  duration_weeks: number | null;
  days_per_week: number | null;
};

type WeightLog = {
  id: string;
  weight_kg: number;
  log_date: string;
  note: string | null;
};

type MeasurementLog = {
  id: string;
  log_date: string;
  waist_cm: number | null;
  hips_cm: number | null;
  chest_cm: number | null;
  left_arm_cm: number | null;
  right_arm_cm: number | null;
  left_thigh_cm: number | null;
  right_thigh_cm: number | null;
  note: string | null;
};

type ProgressPhoto = {
  id: string;
  image_url: string;
  log_date: string;
  note: string | null;
};

type DailyTracking = {
  id: string;
  water_completed: boolean;
  steps_logged: number | null;
};

type MacroTotals = {
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
};

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

function getDateString(date: Date) {
  return date.toISOString().split("T")[0];
}

function shiftDate(dateStr: string, days: number) {
  const date = new Date(`${dateStr}T12:00:00`);
  date.setDate(date.getDate() + days);
  return getDateString(date);
}

function getWeekDates(dateStr: string): { start: string; end: string } {
  const date = new Date(`${dateStr}T12:00:00`);
  const dayOfWeek = date.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Monday = 1
  
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  return {
    start: getDateString(monday),
    end: getDateString(sunday),
  };
}

function getStatusClasses(status: "green" | "amber" | "red") {
  if (status === "green") return "border-green-200 bg-green-50 text-green-700";
  if (status === "amber") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-red-200 bg-red-50 text-red-700";
}

function formatLabel(value: string | null | undefined) {
  if (!value) return "-";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function ClientDetailPage({ params }: PageProps) {
  const [clientId, setClientId] = useState("");
  const [client, setClient] = useState<Client | null>(null);
  const [templates, setTemplates] = useState<ProgramTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [clientProgram, setClientProgram] = useState<ClientProgram | null>(null);
  const [programDays, setProgramDays] = useState<ClientProgramDay[]>([]);
  const [reviewedDayId, setReviewedDayId] = useState<string | null>(null);

  const [dayExercises, setDayExercises] = useState<ClientProgramDayExercise[]>([]);
  const [setLogs, setSetLogs] = useState<ClientProgramSetLog[]>([]);
  const [mealLogs, setMealLogs] = useState<MealLog[]>([]);
  const [customMealLogs, setCustomMealLogs] = useState<CustomMealLog[]>([]);
  const [todayCalories, setTodayCalories] = useState(0);
  const [dailyMacros, setDailyMacros] = useState<MacroTotals>({
    protein: 0,
    carbs: 0,
    fat: 0,
    calories: 0,
  });
  const [weeklyMacros, setWeeklyMacros] = useState<MacroTotals>({
    protein: 0,
    carbs: 0,
    fat: 0,
    calories: 0,
  });
  const [dailyTracking, setDailyTracking] = useState<DailyTracking | null>(null);

  const [latestWeight, setLatestWeight] = useState<WeightLog | null>(null);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [latestMeasurements, setLatestMeasurements] = useState<MeasurementLog | null>(null);
  const [measurementLogs, setMeasurementLogs] = useState<MeasurementLog[]>([]);
  const [progressPhotos, setProgressPhotos] = useState<ProgressPhoto[]>([]);

  const [loading, setLoading] = useState(true);
  const [assigningTemplate, setAssigningTemplate] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getDateString(new Date()));

  const readableDate = useMemo(() => {
    return new Date(`${selectedDate}T12:00:00`).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, [selectedDate]);

  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);

  const readableWeek = useMemo(() => {
    const start = new Date(`${weekDates.start}T12:00:00`).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
    const end = new Date(`${weekDates.end}T12:00:00`).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
    return `${start} - ${end}`;
  }, [weekDates]);

  const weightChartData = [...weightLogs]
    .sort((a, b) => a.log_date.localeCompare(b.log_date))
    .map((log) => ({ date: log.log_date, weight: Number(log.weight_kg) }));

  const waistChartData = [...measurementLogs]
    .sort((a, b) => a.log_date.localeCompare(b.log_date))
    .filter((log) => log.waist_cm !== null)
    .map((log) => ({ date: log.log_date, waist: Number(log.waist_cm) }));

  const totalAssignedSets = useMemo(
    () => dayExercises.reduce((sum, exercise) => sum + (exercise.sets ?? 0), 0),
    [dayExercises]
  );

  const completedSets = useMemo(
    () => setLogs.filter((log) => log.completed).length,
    [setLogs]
  );

  const workoutStatus = useMemo(() => {
    if (!reviewedDayId || totalAssignedSets === 0) {
      return { status: "red" as const, label: "No workout assigned" };
    }

    if (completedSets === 0) {
      return {
        status: "red" as const,
        label: `0/${totalAssignedSets} sets complete`,
      };
    }

    if (completedSets >= totalAssignedSets) {
      return {
        status: "green" as const,
        label: `${Math.min(completedSets, totalAssignedSets)}/${totalAssignedSets} sets complete`,
      };
    }

    return {
      status: "amber" as const,
      label: `${completedSets}/${totalAssignedSets} sets complete`,
    };
  }, [reviewedDayId, totalAssignedSets, completedSets]);

  const nutritionStatus = useMemo(() => {
    if (client?.calorie_target === null || client?.calorie_target === undefined) {
      return { status: "red" as const, label: `${todayCalories} kcal logged` };
    }

    const diff = Math.abs(client.calorie_target - todayCalories);

    if (diff <= 100) {
      return {
        status: "green" as const,
        label: `${todayCalories}/${client.calorie_target} kcal`,
      };
    }
    if (diff <= 300) {
      return {
        status: "amber" as const,
        label: `${todayCalories}/${client.calorie_target} kcal`,
      };
    }
    return {
      status: "red" as const,
      label: `${todayCalories}/${client.calorie_target} kcal`,
    };
  }, [client, todayCalories]);

  useEffect(() => {
    const loadBaseData = async () => {
      const resolvedParams = await params;
      const id = resolvedParams.id;
      setClientId(id);

      const { data: clientData } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id)
        .single();

      if (clientData) setClient(clientData);

      const { data: weightData } = await supabase
        .from("client_weight_logs")
        .select("*")
        .eq("client_id", id)
        .order("log_date", { ascending: false });

      if (weightData?.length) {
        setLatestWeight(weightData[0]);
        setWeightLogs(weightData);
      } else {
        setLatestWeight(null);
        setWeightLogs([]);
      }

      const { data: measurementData } = await supabase
        .from("client_measurement_logs")
        .select("*")
        .eq("client_id", id)
        .order("log_date", { ascending: false });

      if (measurementData?.length) {
        setLatestMeasurements(measurementData[0]);
        setMeasurementLogs(measurementData);
      } else {
        setLatestMeasurements(null);
        setMeasurementLogs([]);
      }

      const { data: photoData } = await supabase
        .from("progress_photos")
        .select("*")
        .eq("client_id", id)
        .order("log_date", { ascending: false})
        .limit(24);

      setProgressPhotos(photoData ?? []);

      const { data: templateData } = await supabase
        .from("program_templates")
        .select("*")
        .order("duration_weeks", { ascending: true })
        .order("days_per_week", { ascending: true });

      setTemplates(templateData ?? []);

      const { data: programData } = await supabase
        .from("client_programs")
        .select("*")
        .eq("client_id", id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (programData?.length) {
        const latestProgram = programData[0];
        setClientProgram(latestProgram);
        if (latestProgram.program_template_id) {
          setSelectedTemplateId(latestProgram.program_template_id);
        }

        const { data: daysData } = await supabase
          .from("client_program_days")
          .select("*")
          .eq("client_program_id", latestProgram.id)
          .order("sort_order", { ascending: true });

        setProgramDays(daysData ?? []);
      }

      setLoading(false);
    };

    loadBaseData();
  }, [params]);

  useEffect(() => {
    const loadDateData = async () => {
      if (!clientId) return;

      setMealLogs([]);
      setCustomMealLogs([]);
      setTodayCalories(0);
      setDailyMacros({ protein: 0, carbs: 0, fat: 0, calories: 0 });
      setSetLogs([]);
      setDayExercises([]);
      setReviewedDayId(null);
      setDailyTracking(null);

      // Load daily tracking
      const { data: trackingData } = await supabase
        .from("daily_tracking")
        .select("*")
        .eq("client_id", clientId)
        .eq("log_date", selectedDate)
        .maybeSingle();

      if (trackingData) {
        setDailyTracking(trackingData);
      }

      // Load daily meal data with macros
      const { data: mealData } = await supabase
        .from("meal_logs")
        .select("id, recipe_id, completed, quantity, recipes(name, calories, protein_g, carbs_g, fat_g)")
        .eq("client_id", clientId)
        .eq("log_date", selectedDate)
        .eq("completed", true);

      let dailyProtein = 0;
      let dailyCarbs = 0;
      let dailyFat = 0;
      let dailyCalories = 0;

      if (mealData) {
        const normalizedMealLogs: MealLog[] = mealData.map((item: any) => {
          const recipeData = Array.isArray(item.recipes)
            ? item.recipes[0] ?? null
            : item.recipes ?? null;

          return {
            id: item.id,
            recipe_id: item.recipe_id,
            completed: item.completed,
            quantity: item.quantity ?? 1,
            recipes: recipeData
              ? {
                  name: recipeData.name ?? "",
                  calories: recipeData.calories ?? null,
                  protein_g: recipeData.protein_g ?? null,
                  carbs_g: recipeData.carbs_g ?? null,
                  fat_g: recipeData.fat_g ?? null,
                }
              : null,
          };
        });

        setMealLogs(normalizedMealLogs);

        normalizedMealLogs.forEach((meal) => {
          const quantity = meal.quantity ?? 1;
          dailyCalories += (meal.recipes?.calories ?? 0) * quantity;
          dailyProtein += (meal.recipes?.protein_g ?? 0) * quantity;
          dailyCarbs += (meal.recipes?.carbs_g ?? 0) * quantity;
          dailyFat += (meal.recipes?.fat_g ?? 0) * quantity;
        });
      }

      const { data: customMealData } = await supabase
        .from("custom_meal_logs")
        .select("*")
        .eq("client_id", clientId)
        .eq("log_date", selectedDate)
        .order("created_at", { ascending: false });

      if (customMealData) {
        setCustomMealLogs(customMealData);
        dailyCalories += customMealData.reduce(
          (sum, meal) => sum + (meal.calories ?? 0),
          0
        );
      }

      setTodayCalories(dailyCalories);
      setDailyMacros({
        protein: Math.round(dailyProtein),
        carbs: Math.round(dailyCarbs),
        fat: Math.round(dailyFat),
        calories: dailyCalories,
      });

      // Load weekly meal data
      const { data: weeklyMealData } = await supabase
        .from("meal_logs")
        .select("id, recipe_id, completed, quantity, recipes(name, calories, protein_g, carbs_g, fat_g)")
        .eq("client_id", clientId)
        .gte("log_date", weekDates.start)
        .lte("log_date", weekDates.end)
        .eq("completed", true);

      let weeklyProtein = 0;
      let weeklyCarbs = 0;
      let weeklyFat = 0;
      let weeklyCalories = 0;

      if (weeklyMealData) {
        weeklyMealData.forEach((item: any) => {
          const recipeData = Array.isArray(item.recipes)
            ? item.recipes[0] ?? null
            : item.recipes ?? null;
          
          const quantity = item.quantity ?? 1;
          
          if (recipeData) {
            weeklyCalories += (recipeData.calories ?? 0) * quantity;
            weeklyProtein += (recipeData.protein_g ?? 0) * quantity;
            weeklyCarbs += (recipeData.carbs_g ?? 0) * quantity;
            weeklyFat += (recipeData.fat_g ?? 0) * quantity;
          }
        });
      }

      const { data: weeklyCustomMealData } = await supabase
        .from("custom_meal_logs")
        .select("*")
        .eq("client_id", clientId)
        .gte("log_date", weekDates.start)
        .lte("log_date", weekDates.end);

      if (weeklyCustomMealData) {
        weeklyCalories += weeklyCustomMealData.reduce(
          (sum, meal) => sum + (meal.calories ?? 0),
          0
        );
      }

      setWeeklyMacros({
        protein: Math.round(weeklyProtein),
        carbs: Math.round(weeklyCarbs),
        fat: Math.round(weeklyFat),
        calories: weeklyCalories,
      });

      if (!clientProgram) return;

      const dayStart = `${selectedDate}T00:00:00`;
      const dayEnd = `${selectedDate}T23:59:59`;

      const { data: logsData } = await supabase
        .from("client_program_set_logs")
        .select("*")
        .eq("client_id", clientId)
        .eq("client_program_id", clientProgram.id)
        .gte("created_at", dayStart)
        .lte("created_at", dayEnd)
        .order("created_at", { ascending: true });

      const typedLogs = (logsData ?? []) as ClientProgramSetLog[];
      setSetLogs(typedLogs);

      let resolvedDayId: string | null = null;

      if (typedLogs.length > 0) {
        resolvedDayId = typedLogs[0].client_program_day_id;
      } else if (programDays.length > 0 && clientProgram.current_day_index !== null) {
        const sortedProgramDays = [...programDays].sort(
          (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
        );
        resolvedDayId =
          sortedProgramDays[clientProgram.current_day_index] ?? sortedProgramDays[0]
            ? sortedProgramDays[clientProgram.current_day_index]?.id ??
              sortedProgramDays[0]?.id
            : null;
      } else if (programDays.length > 0) {
        resolvedDayId = [...programDays].sort(
          (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
        )[0]?.id;
      }

      setReviewedDayId(resolvedDayId);

      if (resolvedDayId) {
        const { data: assignedExercises } = await supabase
          .from("client_program_day_exercises")
          .select("*")
          .eq("client_program_day_id", resolvedDayId)
          .order("sort_order", { ascending: true });

        setDayExercises((assignedExercises ?? []) as ClientProgramDayExercise[]);
      }
    };

    loadDateData();
  }, [selectedDate, clientId, clientProgram, programDays, weekDates]);

  const handleAssignTemplate = async () => {
    if (!clientId || !selectedTemplateId) {
      alert("Please choose a template");
      return;
    }

    setAssigningTemplate(true);

    const { data: existingPrograms } = await supabase
      .from("client_programs")
      .select("id")
      .eq("client_id", clientId);

    if (existingPrograms?.length) {
      await supabase.from("client_programs").delete().eq("client_id", clientId);
    }

    const { data: newProgram, error: programError } = await supabase
      .from("client_programs")
      .insert([
        {
          client_id: clientId,
          program_template_id: selectedTemplateId,
          current_day_index: 0,
        },
      ])
      .select()
      .single();

    if (programError || !newProgram) {
      alert("Error assigning template");
      setAssigningTemplate(false);
      return;
    }

    const { data: templateDays, error: templateDaysError } = await supabase
      .from("program_template_days")
      .select("*")
      .eq("program_template_id", selectedTemplateId)
      .order("sort_order", { ascending: true });

    if (templateDaysError) {
      alert("Error loading template days");
      setAssigningTemplate(false);
      return;
    }

    if (templateDays?.length) {
      for (const templateDay of templateDays) {
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
          alert("Error creating client programme day");
          setAssigningTemplate(false);
          return;
        }

        const { data: templateExercises, error: templateExercisesError } =
          await supabase
            .from("program_template_exercises")
            .select("*")
            .eq("program_template_day_id", templateDay.id)
            .order("sort_order", { ascending: true });

        if (templateExercisesError) {
          alert("Error loading template exercises");
          setAssigningTemplate(false);
          return;
        }

        if (templateExercises?.length) {
          const clientExerciseRows = templateExercises.map((exercise) => ({
            client_program_day_id: clientDay.id,
            exercise_name: exercise.exercise_name,
            sets: exercise.sets,
            reps: exercise.reps,
            target_weight_kg: exercise.target_weight_kg,
            sort_order: exercise.sort_order,
          }));

          const { error: insertExercisesError } = await supabase
            .from("client_program_day_exercises")
            .insert(clientExerciseRows);

          if (insertExercisesError) {
            alert("Error creating client programme exercises");
            setAssigningTemplate(false);
            return;
          }
        }
      }
    }

const { data: refreshedDays } = await supabase
  .from("client_program_days")
  .select("*")
  .eq("client_program_id", newProgram.id)
  .order("sort_order", { ascending: true });

setProgramDays(refreshedDays ?? []);

// 🔔 Send notification to client
if (client) {
  const template = templates.find((t) => t.id === selectedTemplateId);
  if (template) {
await notifyProgramAssigned(clientId, client.full_name, template.name);
  }
}

alert("Template assigned!");
setClientProgram(newProgram);
setAssigningTemplate(false);
  };

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  return (
    <>
      <div className="mb-6 flex items-center gap-4">
        <Link href="/trainer/clients" className={styles.buttonSecondary}>
          ← Back
        </Link>
        <h1 className={styles.display}>Client Detail</h1>
      </div>

      {loading ? (
        <p className={styles.body}>Loading...</p>
      ) : !client ? (
        <p className={styles.body}>Client not found</p>
      ) : (
        <div className="space-y-8">
          {/* CLIENT SUMMARY */}
          <section>
            <h2 className="mb-4 text-2xl font-bold text-ink">Summary</h2>

            <div className={styles.card}>
              <h3 className="text-xl font-semibold text-ink">
                {client.full_name}
              </h3>
              <p className="mt-1 text-ink-muted">{client.email}</p>
            </div>

            <div className={`${styles.card} mt-4`}>
              <h3 className="font-semibold text-ink">Onboarding Summary</h3>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl bg-surface-sunken p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                    Height
                  </p>
                  <p className="mt-1 font-semibold text-ink">
                    {client.height_cm ? `${client.height_cm} cm` : "-"}
                  </p>
                </div>

                <div className="rounded-xl bg-surface-sunken p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                    Weight
                  </p>
                  <p className="mt-1 font-semibold text-ink">
                    {client.weight_kg ? `${client.weight_kg} kg` : "-"}
                  </p>
                </div>

                <div className="rounded-xl bg-surface-sunken p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                    Sex
                  </p>
                  <p className="mt-1 font-semibold text-ink">
                    {formatLabel(client.sex)}
                  </p>
                </div>

                <div className="rounded-xl bg-surface-sunken p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                    Activity
                  </p>
                  <p className="mt-1 font-semibold text-ink">
                    {formatLabel(client.activity_level)}
                  </p>
                </div>

                <div className="rounded-xl bg-surface-sunken p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                    Workout Setup
                  </p>
                  <p className="mt-1 font-semibold text-ink">
                    {formatLabel(client.workout_location)}
                  </p>
                </div>

                <div className="rounded-xl bg-surface-sunken p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                    Days / Week
                  </p>
                  <p className="mt-1 font-semibold text-ink">
                    {client.training_days_per_week ?? "-"}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-gold p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                    BMR Estimate
                  </p>
                  <p className="mt-1 text-lg font-bold text-ink">
                    {client.bmr_estimate ? `${client.bmr_estimate} kcal` : "-"}
                  </p>
                </div>

                <div className="rounded-xl border border-gold p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                    TDEE Estimate
                  </p>
                  <p className="mt-1 text-lg font-bold text-ink">
                    {client.tdee_estimate ? `${client.tdee_estimate} kcal` : "-"}
                  </p>
                </div>

                <div className="rounded-xl border border-emerald p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                    Calorie Target
                  </p>
                  <p className="mt-1 text-lg font-bold text-ink">
                    {client.calorie_target ? `${client.calorie_target} kcal` : "-"}
                  </p>
                </div>
              </div>
            </div>

            <div className={`${styles.card} mt-4`}>
              <h3 className="font-semibold text-ink">Programme Assignment</h3>

              <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
                <div>
                  <label className="text-sm font-medium text-ink">
                    Choose template
                  </label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className={styles.input}
                  >
                    <option value="">Select a template</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>

                  {selectedTemplate && (
                    <p className="mt-2 text-sm text-ink-muted">
                      {selectedTemplate.duration_weeks ?? "-"} weeks •{" "}
                      {selectedTemplate.days_per_week ?? "-"} days per week
                    </p>
                  )}

                  {clientProgram && (
                    <p className="mt-2 text-sm text-ink-muted">
                      A programme is currently assigned to this client.
                    </p>
                  )}
                </div>

                <div className="flex items-end">
                  <button
                    onClick={handleAssignTemplate}
                    disabled={assigningTemplate}
                    className={`${styles.buttonPrimary} disabled:opacity-50`}
                  >
                    {assigningTemplate ? "Assigning..." : "Assign Template"}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* DAILY REVIEW */}
          <section>
            <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-ink">Daily Review</h2>
                <p className="mt-1 text-sm text-ink-muted">{readableDate}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDate((prev) => shiftDate(prev, -1))}
                  className={styles.buttonSecondary}
                >
                  Previous Day
                </button>

                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className={styles.input}
                />

                <button
                  type="button"
                  onClick={() => setSelectedDate(getDateString(new Date()))}
                  className={styles.buttonSecondary}
                >
                  Today
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedDate((prev) => shiftDate(prev, 1))}
                  className={styles.buttonSecondary}
                >
                  Next Day
                </button>
              </div>
            </div>

            {/* Workout Section */}
            <div className="mb-6">
              <div className="mb-3 flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-navy"></div>
                <h3 className="text-lg font-semibold text-navy">Workout</h3>
              </div>

              <div className="space-y-4">
                <div className={`rounded-xl border p-4 ${getStatusClasses(workoutStatus.status)}`}>
                  <p className="text-xs font-medium uppercase tracking-wide">
                    Workout Status
                  </p>
                  <p className="mt-1 text-sm font-semibold">{workoutStatus.label}</p>
                </div>

                {/* Steps Card */}
                <div className="rounded-xl border border-navy/20 bg-surface-raised p-4">
                  <p className="text-sm font-medium text-ink">Steps</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <p className="text-2xl font-bold text-navy">
                      {dailyTracking?.steps_logged?.toLocaleString() ?? "0"}
                    </p>
                    <p className="text-sm text-ink-muted">
                      / {client.daily_step_target.toLocaleString()}
                    </p>
                  </div>
                  {dailyTracking?.steps_logged !== null && (
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
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

                <div className={styles.card}>
                  <h4 className="font-semibold text-ink">Workout Logs</h4>

                  <div className="mt-4 space-y-2">
                    {setLogs.length === 0 ? (
                      <p className="text-ink-muted">No workout activity logged for this day</p>
                    ) : (
                      setLogs.map((log) => {
                        const exercise = dayExercises.find(
                          (e) => e.id === log.client_program_day_exercise_id
                        );

                        return (
                          <div
                            key={log.id}
                            className="rounded-lg border border-border-subtle px-3 py-2"
                          >
                            <p className="font-medium text-ink">
                              {exercise?.exercise_name || "Exercise"}
                            </p>
                            <p className="text-sm text-ink-muted">
                              Set {log.set_number} • {log.actual_weight_kg ?? "-"}kg •{" "}
                              {log.actual_reps ?? "-"} reps {log.completed ? "✅" : ""}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Nutrition Section */}
            <div>
              <div className="mb-3 flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-emerald"></div>
                <h3 className="text-lg font-semibold text-emerald">Nutrition</h3>
              </div>

              <div className="space-y-4">
                <div className={`rounded-xl border p-4 ${getStatusClasses(nutritionStatus.status)}`}>
                  <p className="text-xs font-medium uppercase tracking-wide">
                    Nutrition Status
                  </p>
                  <p className="mt-1 text-sm font-semibold">{nutritionStatus.label}</p>
                </div>

                {/* Daily Macros Card */}
                <div className="rounded-xl border border-emerald/20 bg-surface-raised p-4">
                  <h4 className="font-semibold text-ink">Daily Macros</h4>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                        Protein
                      </p>
                      <p className="mt-1 text-2xl font-bold text-emerald">
                        {dailyMacros.protein}g
                      </p>
                      {client.protein_g && (
                        <p className="text-xs text-ink-muted">Target: {client.protein_g}g</p>
                      )}
                    </div>
                    
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                        Carbs
                      </p>
                      <p className="mt-1 text-2xl font-bold text-emerald">
                        {dailyMacros.carbs}g
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                        Fat
                      </p>
                      <p className="mt-1 text-2xl font-bold text-emerald">
                        {dailyMacros.fat}g
                      </p>
                    </div>
                  </div>
                </div>

                {/* Weekly Macros Card */}
                <div className="rounded-xl border border-emerald/20 bg-surface-raised p-4">
                  <div className="flex items-baseline gap-2">
                    <h4 className="font-semibold text-ink">Weekly Macros</h4>
                    <p className="text-xs text-ink-muted">{readableWeek}</p>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                        Calories
                      </p>
                      <p className="mt-1 text-xl font-bold text-emerald">
                        {weeklyMacros.calories}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                        Protein
                      </p>
                      <p className="mt-1 text-xl font-bold text-emerald">
                        {weeklyMacros.protein}g
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                        Carbs
                      </p>
                      <p className="mt-1 text-xl font-bold text-emerald">
                        {weeklyMacros.carbs}g
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                        Fat
                      </p>
                      <p className="mt-1 text-xl font-bold text-emerald">
                        {weeklyMacros.fat}g
                      </p>
                    </div>
                  </div>
                </div>

                {/* Water Card */}
                <div className="rounded-xl border border-emerald/20 bg-surface-raised p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-ink">Water (2L target)</p>
                      <p className="mt-1 text-2xl font-bold text-emerald">
                        {dailyTracking?.water_completed ? "Complete ✓" : "Not logged"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.card}>
                  <h4 className="font-semibold text-ink">Recipe Meals Logged</h4>

                  <div className="mt-4 space-y-2">
                    {mealLogs.length === 0 ? (
                      <p className="text-ink-muted">No recipe meals logged for this day</p>
                    ) : (
                      mealLogs.map((meal) => {
                        const quantity = meal.quantity ?? 1;
                        const caloriesPerMeal = meal.recipes?.calories ?? 0;
                        const totalMealCalories = caloriesPerMeal * quantity;

                        return (
                          <div
                            key={meal.id}
                            className="flex items-center justify-between rounded-lg border border-border-subtle px-3 py-2"
                          >
                            <div>
                              <span className="font-medium text-ink">
                                {meal.recipes?.name || "Unnamed meal"}
                              </span>
                              <p className="text-sm text-ink-muted">
                                Quantity: {quantity}
                              </p>
                            </div>

                            <span className="text-sm text-ink">
                              {totalMealCalories} kcal
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className={styles.card}>
                  <h4 className="font-semibold text-ink">Custom Meals Logged</h4>

                  <div className="mt-4 space-y-2">
                    {customMealLogs.length === 0 ? (
                      <p className="text-ink-muted">No custom meals logged for this day</p>
                    ) : (
                      customMealLogs.map((meal) => (
                        <div
                          key={meal.id}
                          className="flex items-center justify-between rounded-lg border border-border-subtle px-3 py-2"
                        >
                          <div>
                            <span className="font-medium text-ink">
                              {meal.meal_name}
                            </span>
                            {meal.note && (
                              <p className="text-sm text-ink-muted">{meal.note}</p>
                            )}
                          </div>

                          <span className="text-sm text-ink">
                            {meal.calories} kcal
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* STATS & PROGRESS */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <div className="h-1 w-1 rounded-full bg-gold"></div>
              <h2 className="text-2xl font-bold text-gold">Stats & Progress</h2>
            </div>

            <div className="space-y-4">
              <div className={styles.card}>
                <h3 className="font-semibold text-ink">Latest Weight</h3>
                <p className="mt-2 text-lg font-semibold text-ink">
                  {latestWeight ? `${latestWeight.weight_kg} kg` : "No weight logged yet"}
                </p>
                {latestWeight && (
                  <p className="mt-1 text-sm text-ink-muted">
                    Logged on {latestWeight.log_date}
                  </p>
                )}

                <div className="mt-6">
                  <h4 className="mb-3 text-sm font-medium text-ink">
                    Weight Progress
                  </h4>

                  {weightChartData.length < 2 ? (
                    <p className={styles.body}>Not enough weight logs yet to show a graph.</p>
                  ) : (
                    <div className="w-full min-w-0">
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={weightChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis domain={["dataMin - 1", "dataMax + 1"]} />
                          <Tooltip />
                          <Line type="monotone" dataKey="weight" strokeWidth={2} dot />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-2">
                  {weightLogs.length === 0 ? (
                    <p className={styles.body}>No weight history yet.</p>
                  ) : (
                    weightLogs.slice(0, 10).map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between rounded-lg border border-border-subtle px-3 py-2"
                      >
                        <span className="text-sm text-ink-muted">{log.log_date}</span>
                        <span className="font-medium text-ink">
                          {log.weight_kg} kg
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className={styles.card}>
                <h3 className="font-semibold text-ink">Latest Measurements</h3>
                <p className="mt-2 text-sm text-ink-muted">
                  Latest waist:{" "}
                  {latestMeasurements?.waist_cm !== null &&
                  latestMeasurements?.waist_cm !== undefined
                    ? `${latestMeasurements.waist_cm} cm`
                    : "No measurements logged yet"}
                </p>
                {latestMeasurements && (
                  <p className="mt-1 text-sm text-ink-muted">
                    Logged on {latestMeasurements.log_date}
                  </p>
                )}

                <div className="mt-6">
                  <h4 className="mb-3 text-sm font-medium text-ink">
                    Waist Progress
                  </h4>

                  {waistChartData.length < 2 ? (
                    <p className={styles.body}>
                      Not enough measurement logs yet to show a graph.
                    </p>
                  ) : (
                    <div className="w-full min-w-0">
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={waistChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis domain={["dataMin - 1", "dataMax + 1"]} />
                          <Tooltip />
                          <Line type="monotone" dataKey="waist" strokeWidth={2} dot />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-2">
                  {measurementLogs.length === 0 ? (
                    <p className={styles.body}>No measurement history yet.</p>
                  ) : (
                    measurementLogs.slice(0, 10).map((log) => (
                      <div
                        key={log.id}
                        className="rounded-lg border border-border-subtle px-3 py-2"
                      >
                        <p className="text-sm font-medium text-ink">
                          {log.log_date}
                        </p>
                        <p className="text-sm text-ink-muted">
                          Waist: {log.waist_cm ?? "-"} cm • Hips: {log.hips_cm ?? "-"} cm •
                          Chest: {log.chest_cm ?? "-"} cm
                        </p>
                        <p className="text-sm text-ink-muted">
                          Arms: {log.left_arm_cm ?? "-"} / {log.right_arm_cm ?? "-"} cm •
                          Thighs: {log.left_thigh_cm ?? "-"} / {log.right_thigh_cm ?? "-"} cm
                        </p>
                        {log.note && (
                          <p className="text-sm text-ink-muted">{log.note}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className={styles.card}>
                <h3 className="font-semibold text-ink">Progress Photos</h3>

                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {progressPhotos.length === 0 ? (
                    <p className="text-ink-muted">No progress photos uploaded yet</p>
                  ) : (
                    progressPhotos.map((photo) => (
                      <div key={photo.id} className={`${styles.card} p-3`}>
                        <img
                          src={photo.image_url}
                          alt="Progress"
                          className="h-56 w-full rounded-xl object-cover"
                        />
                        <p className="mt-2 text-sm font-medium text-ink">
                          {photo.log_date}
                        </p>
                        {photo.note && (
                          <p className="mt-1 text-sm text-ink-muted">{photo.note}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}