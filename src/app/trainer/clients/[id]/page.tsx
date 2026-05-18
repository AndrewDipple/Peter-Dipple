"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { withSignedProgressPhotoUrls } from "@/lib/privateStorage";
import { notifyProgramAssigned } from "@/components/notifications";
import TrainerClientMessages from "@/components/TrainerClientMessages";
import TrainerClientInsights from "@/components/TrainerClientInsights";
import ProgressPhotoComparison, {
  buildProgressPhotoWeeks,
  type ComparisonProgressPhoto,
} from "@/components/ProgressPhotoComparison";
import { styles } from "@/lib/design";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { lookupExerciseIdsByName, getExerciseIdForName } from "@/lib/exerciseLinking";
import { X } from "lucide-react";
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
    calorie_adjustment: number | null;          // NEW
  trainer_activity_level: string | null;      // NEW
  archived_at?: string | null;
  deletion_requested_at?: string | null;
  delete_after?: string | null;
  terms_accepted_at?: string | null;
  privacy_accepted_at?: string | null;
  health_data_consent_at?: string | null;
  marketing_consent_at?: string | null;
  terms_version?: string | null;
  privacy_version?: string | null;
  marketing_consent_version?: string | null;
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
  created_at?: string | null;
  status?: "active" | "assigning" | "superseded" | string | null;
  archived_at?: string | null;
  completed_at?: string | null;
  superseded_by_program_id?: string | null;
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
  storage_path: string | null;
  signed_url?: string | null;
  log_date: string;
  note: string | null;
  photo_type: "front" | "back" | "side";
};

type DailyTracking = {
  id: string;
  water_completed: boolean;
  steps_logged: number | null;
};

type AdminAuditEvent = {
  id: string;
  event_type: string;
  actor_profile_id: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

type MacroTotals = {
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
};

type WeightTrendReview = {
  status: "good" | "watch" | "review" | "insufficient";
  title: string;
  detail: string;
  weeklyChangeKg: number | null;
  weeklyChangePct: number | null;
  daysCovered: number;
  logsUsed: number;
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

function getActivityFactor(activityLevel: string | null | undefined) {
  const factors: Record<string, number> = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    very_active: 1.725,
    extra_active: 1.9,
  };

  if (!activityLevel) return 1.2;
  return factors[activityLevel] ?? 1.2;
}

const ACTIVITY_OPTIONS = [
  { value: "sedentary", label: "Sedentary (little/no exercise)" },
  { value: "lightly_active", label: "Lightly active (1-3 days/week)" },
  { value: "moderately_active", label: "Moderately active (3-5 days/week)" },
  { value: "very_active", label: "Very active (6-7 days/week)" },
  { value: "extra_active", label: "Extra active (physical job + training)" },
];

export default function ClientDetailPage({ params }: PageProps) {
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [client, setClient] = useState<Client | null>(null);
  const [templates, setTemplates] = useState<ProgramTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [clientProgram, setClientProgram] = useState<ClientProgram | null>(null);
  const [programHistory, setProgramHistory] = useState<ClientProgram[]>([]);
  const [restoringProgramId, setRestoringProgramId] = useState<string | null>(null);
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
  const [showAllPhotoWeeks, setShowAllPhotoWeeks] = useState(false);
  const [enlargedPhoto, setEnlargedPhoto] = useState<{
    photo: ProgressPhoto;
    label: string;
    weekNumber: number;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [assigningTemplate, setAssigningTemplate] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getDateString(new Date()));

const [trainerActivity, setTrainerActivity] = useState<string>("");
const [calorieAdjustment, setCalorieAdjustment] = useState<string>("0");
const [savingTarget, setSavingTarget] = useState(false);
const [savedFlash, setSavedFlash] = useState(false);
const [currentRole, setCurrentRole] = useState<string | null>(null);
const [deleteConfirmation, setDeleteConfirmation] = useState("");
const [deletingClient, setDeletingClient] = useState(false);
const [deleteError, setDeleteError] = useState<string | null>(null);
const [exportingClient, setExportingClient] = useState(false);
const [exportError, setExportError] = useState<string | null>(null);
const [sarExportNote, setSarExportNote] = useState("");
const [retentionUpdating, setRetentionUpdating] = useState<string | null>(null);
const [retentionError, setRetentionError] = useState<string | null>(null);
const [auditEvents, setAuditEvents] = useState<AdminAuditEvent[]>([]);
const [auditLoading, setAuditLoading] = useState(false);

  const photoWeeks = useMemo(
    () => buildProgressPhotoWeeks(progressPhotos as ComparisonProgressPhoto[]),
    [progressPhotos]
  );

  const getPhotoUrl = (photo: ComparisonProgressPhoto) =>
    photo.signed_url ?? photo.image_url;

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

const proposedTarget = useMemo(() => {
  if (!client?.bmr_estimate || !trainerActivity) return null;

  const factor = getActivityFactor(trainerActivity);
  const tdee = client.bmr_estimate * factor;
  const adjustment = parseInt(calorieAdjustment) || 0;

  return Math.round(tdee + adjustment);
}, [client?.bmr_estimate, trainerActivity, calorieAdjustment]);

const proposedTdee = useMemo(() => {
  if (!client?.bmr_estimate || !trainerActivity) return null;
  return Math.round(client.bmr_estimate * getActivityFactor(trainerActivity));
}, [client?.bmr_estimate, trainerActivity]);

const weightTrendReview = useMemo<WeightTrendReview>(() => {
  const sortedLogs = [...weightLogs]
    .sort((a, b) => a.log_date.localeCompare(b.log_date))
    .slice(-8);

  if (sortedLogs.length < 4) {
    return {
      status: "insufficient",
      title: "More data needed",
      detail: "At least four recent weight logs are needed before trend review is useful.",
      weeklyChangeKg: null,
      weeklyChangePct: null,
      daysCovered: 0,
      logsUsed: sortedLogs.length,
    };
  }

  const first = sortedLogs[0];
  const latest = sortedLogs[sortedLogs.length - 1];
  const daysCovered = Math.max(
    1,
    Math.round(
      (new Date(`${latest.log_date}T12:00:00`).getTime() -
        new Date(`${first.log_date}T12:00:00`).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );

  if (daysCovered < 14) {
    return {
      status: "insufficient",
      title: "Trend still settling",
      detail: "Weight logs need to cover at least 14 days before this review is useful.",
      weeklyChangeKg: null,
      weeklyChangePct: null,
      daysCovered,
      logsUsed: sortedLogs.length,
    };
  }

  const totalChangeKg = Number(latest.weight_kg) - Number(first.weight_kg);
  const weeklyChangeKg = (totalChangeKg / daysCovered) * 7;
  const baselineWeight = Number(first.weight_kg) || Number(latest.weight_kg);
  const weeklyChangePct = baselineWeight
    ? (weeklyChangeKg / baselineWeight) * 100
    : 0;
  const lossPct = -weeklyChangePct;

  if (weeklyChangePct > 0.1) {
    return {
      status: "review",
      title: "Weight trending upward",
      detail:
        "This is worth a calorie target or logging accuracy review if weight loss is still the goal.",
      weeklyChangeKg,
      weeklyChangePct,
      daysCovered,
      logsUsed: sortedLogs.length,
    };
  }

  if (lossPct > 1) {
    return {
      status: "review",
      title: "Weight dropping quickly",
      detail:
        "Review hunger, recovery, adherence, and whether the calorie target is too aggressive.",
      weeklyChangeKg,
      weeklyChangePct,
      daysCovered,
      logsUsed: sortedLogs.length,
    };
  }

  if (lossPct < 0.25) {
    return {
      status: "watch",
      title: "Weight trend is fairly flat",
      detail:
        "If adherence is strong, consider reviewing the calorie target or weekend intake pattern.",
      weeklyChangeKg,
      weeklyChangePct,
      daysCovered,
      logsUsed: sortedLogs.length,
    };
  }

  return {
    status: "good",
    title: "Trend looks sensible",
    detail:
      "Current weight trend is within a conservative weight-loss range. Peter should still sense-check context.",
    weeklyChangeKg,
    weeklyChangePct,
    daysCovered,
    logsUsed: sortedLogs.length,
  };
}, [weightLogs]);

  useEffect(() => {
    const loadBaseData = async () => {
      const resolvedParams = await params;
      const id = resolvedParams.id;
      setClientId(id);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        setCurrentRole(profileData?.role ?? null);

        if (profileData?.role === "admin") {
          setAuditLoading(true);
          const { data: auditData, error: auditError } = await supabase
            .from("admin_audit_events")
            .select("id, event_type, actor_profile_id, created_at, metadata")
            .eq("target_client_id", id)
            .order("created_at", { ascending: false })
            .limit(10);

          if (auditError) {
            console.warn("Could not load admin audit events", auditError);
          } else {
            setAuditEvents((auditData ?? []) as AdminAuditEvent[]);
          }

          setAuditLoading(false);
        }
      }

      const { data: clientData } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id)
        .single();

      if (clientData) setClient(clientData);

if (clientData) {
  setClient(clientData);

  // Initialise the calorie panel inputs from the loaded client.
  setTrainerActivity(
    clientData.trainer_activity_level ?? clientData.activity_level ?? ""
  );
  setCalorieAdjustment(String(clientData.calorie_adjustment ?? 0));
}

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

      setProgressPhotos(
        photoData ? await withSignedProgressPhotoUrls(photoData) : []
      );

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
        .or("status.eq.active,status.is.null")
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
      } else {
        setClientProgram(null);
        setProgramDays([]);
      }

      const { data: allProgramData } = await supabase
        .from("client_programs")
        .select("*")
        .eq("client_id", id)
        .order("created_at", { ascending: false });

      setProgramHistory((allProgramData ?? []) as ClientProgram[]);

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

      const { data: logsData } = await supabase
        .from("client_program_set_logs")
        .select("*")
        .eq("client_id", clientId)
        .eq("log_date", selectedDate)
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

      const loggedExerciseIds = [
        ...new Set(
          typedLogs.map((log) => log.client_program_day_exercise_id).filter(Boolean)
        ),
      ];

      if (loggedExerciseIds.length > 0) {
        const { data: loggedExercises } = await supabase
          .from("client_program_day_exercises")
          .select("*")
          .in("id", loggedExerciseIds);

        const loggedExerciseMap = new Map(
          ((loggedExercises ?? []) as ClientProgramDayExercise[]).map(
            (exercise) => [exercise.id, exercise]
          )
        );

        setDayExercises(
          loggedExerciseIds
            .map((id) => loggedExerciseMap.get(id))
            .filter((exercise): exercise is ClientProgramDayExercise =>
              Boolean(exercise)
            )
        );
      } else if (resolvedDayId) {
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
      .eq("client_id", clientId)
      .or("status.eq.active,status.is.null");

    if (existingPrograms?.length) {
      const confirmed = window.confirm(
        "This will assign a new active programme and archive the current one for history. Use Edit Active Programme for individual exercise changes. Continue?"
      );

      if (!confirmed) {
        setAssigningTemplate(false);
        return;
      }
    }

    const { data: newProgram, error: programError } = await supabase
      .from("client_programs")
      .insert([
        {
          client_id: clientId,
          program_template_id: selectedTemplateId,
          current_day_index: 0,
          status: "assigning",
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
  // Look up exercise_id for each name so we get videos, rest timer, alternates etc.
  const exerciseIdMap = await lookupExerciseIdsByName(
    templateExercises.map((e) => e.exercise_name)
  );

  const clientExerciseRows = templateExercises.map((exercise) => ({
    client_program_day_id: clientDay.id,
    exercise_id: getExerciseIdForName(exerciseIdMap, exercise.exercise_name),
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

if (existingPrograms?.length) {
  await supabase
    .from("client_programs")
    .update({
      status: "superseded",
      archived_at: new Date().toISOString(),
      superseded_by_program_id: newProgram.id,
    })
    .eq("client_id", clientId)
    .neq("id", newProgram.id)
    .or("status.eq.active,status.is.null");
}

await supabase
  .from("client_programs")
  .update({ status: "active" })
  .eq("id", newProgram.id);

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
setClientProgram({ ...newProgram, status: "active" });
setProgramHistory((prev) => [
  { ...newProgram, status: "active" },
  ...prev
    .filter((program) => program.id !== newProgram.id)
    .map((program) =>
      program.status === "active" || program.status === null
        ? {
            ...program,
            status: "superseded",
            archived_at: new Date().toISOString(),
            superseded_by_program_id: newProgram.id,
          }
        : program
    ),
]);
setAssigningTemplate(false);
  };
const handleRestoreProgram = async (program: ClientProgram) => {
  if (!client || !clientProgram || restoringProgramId) return;
  if (program.id === clientProgram.id) return;

  const templateName =
    templates.find((template) => template.id === program.program_template_id)
      ?.name ?? "this programme";

  const confirmed = window.confirm(
    `Restore "${templateName}" as the active programme for ${client.full_name}? The current active programme will be archived, not deleted.`
  );

  if (!confirmed) return;

  setRestoringProgramId(program.id);
  const now = new Date().toISOString();

  const { error: archiveError } = await supabase
    .from("client_programs")
    .update({
      status: "superseded",
      archived_at: now,
      superseded_by_program_id: program.id,
    })
    .eq("id", clientProgram.id);

  if (archiveError) {
    alert("Could not archive the current programme.");
    setRestoringProgramId(null);
    return;
  }

  const { data: restoredProgram, error: restoreError } = await supabase
    .from("client_programs")
    .update({
      status: "active",
      archived_at: null,
      superseded_by_program_id: null,
    })
    .eq("id", program.id)
    .select()
    .single();

  if (restoreError || !restoredProgram) {
    alert("Could not restore programme. Please refresh and check programme history.");
    setRestoringProgramId(null);
    return;
  }

  const { data: restoredDays } = await supabase
    .from("client_program_days")
    .select("*")
    .eq("client_program_id", restoredProgram.id)
    .order("sort_order", { ascending: true });

  setClientProgram(restoredProgram as ClientProgram);
  setSelectedTemplateId(restoredProgram.program_template_id ?? "");
  setProgramDays(restoredDays ?? []);
  setProgramHistory((prev) =>
    prev.map((historyProgram) => {
      if (historyProgram.id === restoredProgram.id) {
        return restoredProgram as ClientProgram;
      }

      if (historyProgram.id === clientProgram.id) {
        return {
          ...historyProgram,
          status: "superseded",
          archived_at: now,
          superseded_by_program_id: restoredProgram.id,
        };
      }

      return historyProgram;
    })
  );
  setRestoringProgramId(null);
};
const handleSaveCalorieTarget = async () => {
  if (!client || proposedTarget === null) return;

  setSavingTarget(true);

  const adjustment = parseInt(calorieAdjustment) || 0;

  const { error } = await supabase
    .from("clients")
    .update({
      calorie_target: proposedTarget,
      calorie_adjustment: adjustment,
      trainer_activity_level: trainerActivity,
    })
    .eq("id", client.id);

  if (error) {
    alert("Could not save calorie target");
    setSavingTarget(false);
    return;
  }

  // Mirror saved values back into local state so the existing summary card
  // updates immediately without a refetch.
  setClient({
    ...client,
    calorie_target: proposedTarget,
    calorie_adjustment: adjustment,
    trainer_activity_level: trainerActivity,
  });

  setSavingTarget(false);
  setSavedFlash(true);
  setTimeout(() => setSavedFlash(false), 2000);
};

const handleDeleteClient = async () => {
  if (!client || deletingClient) return;

  const requiredConfirmation = `DELETE ${client.full_name}`;

  if (deleteConfirmation.trim() !== requiredConfirmation) {
    setDeleteError(`Type "${requiredConfirmation}" to confirm.`);
    return;
  }

  setDeletingClient(true);
  setDeleteError(null);

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    setDeleteError("You need to sign in again before deleting this client.");
    setDeletingClient(false);
    return;
  }

  const response = await fetch("/api/admin/delete-client", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ clientId: client.id, note: sarExportNote }),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    setDeleteError(result.error ?? "Could not delete client.");
    setDeletingClient(false);
    return;
  }

  router.push("/trainer/clients");
};

const handleExportClient = async (format: "json" | "csv" = "json") => {
  if (!client || exportingClient) return;

  setExportingClient(true);
  setExportError(null);

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    setExportError("You need to sign in again before exporting this client.");
    setExportingClient(false);
    return;
  }

  const response = await fetch("/api/admin/export-client", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      clientId: client.id,
      note: sarExportNote,
      format,
    }),
  });

  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    setExportError(result.error ?? "Could not export client.");
    setExportingClient(false);
    return;
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const disposition = response.headers.get("Content-Disposition");
  const fileName =
    disposition?.match(/filename="([^"]+)"/)?.[1] ??
    `sar-${client.id}.${format}`;

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setAuditEvents((events) =>
    [
      {
        id: `local-sar-${Date.now()}`,
        event_type: "sar_exported",
        actor_profile_id: null,
        created_at: new Date().toISOString(),
        metadata: { fileName, note: sarExportNote.trim() || null },
      },
      ...events,
    ].slice(0, 10)
  );
  setSarExportNote("");
  setExportingClient(false);
};

const handleRetentionAction = async (
  action: "start_retention" | "record_deletion_request" | "clear_retention"
) => {
  if (!client || retentionUpdating) return;

  setRetentionUpdating(action);
  setRetentionError(null);

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    setRetentionError("You need to sign in again before updating retention.");
    setRetentionUpdating(null);
    return;
  }

  const response = await fetch("/api/admin/client-retention", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ clientId: client.id, action }),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result.client) {
    setRetentionError(result.error ?? "Could not update retention.");
    setRetentionUpdating(null);
    return;
  }

  setClient({
    ...client,
    archived_at: result.client.archived_at,
    deletion_requested_at: result.client.deletion_requested_at,
    delete_after: result.client.delete_after,
  });
  setAuditEvents((events) =>
    [
      {
        id: `local-retention-${Date.now()}`,
        event_type:
          action === "start_retention"
            ? "retention_started"
            : action === "record_deletion_request"
              ? "deletion_requested"
              : "retention_cleared",
        actor_profile_id: null,
        created_at: new Date().toISOString(),
        metadata: {},
      },
      ...events,
    ].slice(0, 10)
  );
  setRetentionUpdating(null);
};

const formatRetentionDate = (date: string | null | undefined) => {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatAuditDate = (date: string) =>
  new Date(date).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatAuditEvent = (eventType: string) => {
  const labels: Record<string, string> = {
    sar_exported: "SAR exported",
    retention_started: "Retention started",
    deletion_requested: "Deletion requested",
    retention_cleared: "Retention cleared",
    client_deleted: "Client deleted",
  };

  return labels[eventType] ?? eventType.replaceAll("_", " ");
};

const getTrendReviewClasses = (status: WeightTrendReview["status"]) => {
  if (status === "good") return "border-emerald bg-emerald/5 text-emerald";
  if (status === "watch") return "border-gold bg-gold/10 text-gold";
  if (status === "review") return "border-red-200 bg-red-50 text-red-700";
  return "border-border-subtle bg-surface-sunken text-ink-muted";
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
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-ink">
                    {client.full_name}
                  </h3>
                  <p className="mt-1 text-ink-muted">{client.email}</p>
                </div>
                <Link
                  href={`/trainer/clients/${client.id}/monthly-report`}
                  className={styles.buttonSecondary}
                >
                  Monthly report
                </Link>
              </div>
            </div>

            {currentRole === "admin" && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-5">
                <h3 className="font-semibold text-red-800">
                  GDPR deletion
                </h3>
                <p className="mt-1 text-sm text-red-700">
                  Permanently deletes this client&apos;s app data, progress photos, profile,
                  and login account. This cannot be undone.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleExportClient("json")}
                    disabled={exportingClient}
                    className={styles.buttonSecondary}
                  >
                    {exportingClient ? "Exporting..." : "Download JSON export"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportClient("csv")}
                    disabled={exportingClient}
                    className={styles.buttonSecondary}
                  >
                    Download CSV export
                  </button>
                </div>
                <label className="mt-4 block text-sm font-medium text-red-800">
                  SAR export note
                </label>
                <textarea
                  value={sarExportNote}
                  onChange={(event) => setSarExportNote(event.target.value)}
                  maxLength={500}
                  rows={2}
                  className={styles.textarea}
                  placeholder="Reason for export, e.g. client requested copy by email"
                  disabled={exportingClient}
                />
                {exportError && (
                  <p className="mt-3 text-sm font-medium text-red-700">
                    {exportError}
                  </p>
                )}
                <div className="mt-4 rounded-md border border-red-200 bg-white/70 p-4">
                  <h4 className="font-semibold text-red-800">
                    Retention status
                  </h4>
                  <div className="mt-3 grid gap-3 text-sm text-red-800 md:grid-cols-3">
                    <div>
                      <p className="font-medium">Archived</p>
                      <p>{formatRetentionDate(client.archived_at)}</p>
                    </div>
                    <div>
                      <p className="font-medium">Deletion requested</p>
                      <p>{formatRetentionDate(client.deletion_requested_at)}</p>
                    </div>
                    <div>
                      <p className="font-medium">Delete/review after</p>
                      <p>{formatRetentionDate(client.delete_after)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col gap-2 md:flex-row md:flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleRetentionAction("start_retention")}
                      disabled={Boolean(retentionUpdating)}
                      className={styles.buttonSecondary}
                    >
                      {retentionUpdating === "start_retention"
                        ? "Saving..."
                        : "Start 12-month retention"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleRetentionAction("record_deletion_request")
                      }
                      disabled={Boolean(retentionUpdating)}
                      className={styles.buttonSecondary}
                    >
                      {retentionUpdating === "record_deletion_request"
                        ? "Saving..."
                        : "Record deletion request"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRetentionAction("clear_retention")}
                      disabled={Boolean(retentionUpdating)}
                      className={styles.buttonSecondary}
                    >
                      {retentionUpdating === "clear_retention"
                        ? "Clearing..."
                        : "Clear retention markers"}
                    </button>
                  </div>
                  {retentionError && (
                    <p className="mt-3 text-sm font-medium text-red-700">
                      {retentionError}
                    </p>
                  )}
                </div>
                <div className="mt-4 rounded-md border border-red-200 bg-white/70 p-4">
                  <h4 className="font-semibold text-red-800">
                    Consent status
                  </h4>
                  <div className="mt-3 grid gap-3 text-sm text-red-800 md:grid-cols-2">
                    <div>
                      <p className="font-medium">Terms accepted</p>
                      <p>{formatRetentionDate(client.terms_accepted_at)}</p>
                    </div>
                    <div>
                      <p className="font-medium">Privacy accepted</p>
                      <p>{formatRetentionDate(client.privacy_accepted_at)}</p>
                    </div>
                    <div>
                      <p className="font-medium">Health data consent</p>
                      <p>{formatRetentionDate(client.health_data_consent_at)}</p>
                    </div>
                    <div>
                      <p className="font-medium">Marketing consent</p>
                      <p>{formatRetentionDate(client.marketing_consent_at)}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 rounded-md border border-red-200 bg-white/70 p-4">
                  <h4 className="font-semibold text-red-800">
                    Recent admin actions
                  </h4>
                  {auditLoading ? (
                    <p className="mt-3 text-sm text-red-700">
                      Loading audit trail...
                    </p>
                  ) : auditEvents.length === 0 ? (
                    <p className="mt-3 text-sm text-red-700">
                      No admin actions recorded for this client yet.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {auditEvents.map((event) => (
                        <div
                          key={event.id}
                          className="rounded-md border border-red-100 bg-white p-3 text-sm"
                        >
                          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                            <p className="font-semibold text-red-800">
                              {formatAuditEvent(event.event_type)}
                            </p>
                            <p className="text-red-700">
                              {formatAuditDate(event.created_at)}
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-red-700">
                            Actor: {event.actor_profile_id ?? "current admin"}
                          </p>
                          {typeof event.metadata?.note === "string" &&
                            event.metadata.note && (
                              <p className="mt-1 text-xs text-red-700">
                                Note: {event.metadata.note}
                              </p>
                            )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <label className="mt-4 block text-sm font-medium text-red-800">
                  Type DELETE {client.full_name} to confirm
                </label>
                <div className="mt-2 flex flex-col gap-3 md:flex-row">
                  <input
                    value={deleteConfirmation}
                    onChange={(event) => {
                      setDeleteConfirmation(event.target.value);
                      setDeleteError(null);
                    }}
                    className={styles.input}
                    disabled={deletingClient}
                  />
                  <button
                    type="button"
                    onClick={handleDeleteClient}
                    disabled={
                      deletingClient ||
                      deleteConfirmation.trim() !== `DELETE ${client.full_name}`
                    }
                    className={styles.buttonDanger}
                  >
                    {deletingClient ? "Deleting..." : "Delete client"}
                  </button>
                </div>
                {deleteError && (
                  <p className="mt-3 text-sm font-medium text-red-700">
                    {deleteError}
                  </p>
                )}
              </div>
            )}

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
            <div className={`${styles.card} mt-4`}>
  <h3 className="font-semibold text-ink">Calorie Target Override</h3>
  <p className="mt-1 text-sm text-ink-muted">
    Adjust the activity level and calorie offset to set this client's daily target.
  </p>

  <div className="mt-4 grid gap-3 md:grid-cols-4">
    {/* BMR — read-only */}
    <div className="rounded-xl border border-border-subtle bg-surface-sunken p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
        BMR
      </p>
      <p className="mt-1 text-lg font-semibold text-ink">
        {client.bmr_estimate ? `${client.bmr_estimate} kcal` : "-"}
      </p>
      <p className="mt-1 text-xs text-ink-muted">From onboarding</p>
    </div>

    {/* Activity level — editable */}
    <div className="rounded-xl border border-border-subtle bg-surface-sunken p-3">
      <label className="text-xs font-medium uppercase tracking-wide text-ink-muted">
        Activity Level
      </label>
      <select
        value={trainerActivity}
        onChange={(e) => setTrainerActivity(e.target.value)}
        className={`${styles.input} mt-1`}
      >
        <option value="">Select</option>
        {ACTIVITY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {client.trainer_activity_level &&
        client.trainer_activity_level !== client.activity_level && (
          <p className="mt-1 text-xs text-ink-muted">
            Client said: {formatLabel(client.activity_level)}
          </p>
        )}
    </div>

    {/* Adjustment — editable */}
    <div className="rounded-xl border border-border-subtle bg-surface-sunken p-3">
      <label className="text-xs font-medium uppercase tracking-wide text-ink-muted">
        Adjustment
      </label>
      <input
        type="number"
        value={calorieAdjustment}
        onChange={(e) => setCalorieAdjustment(e.target.value)}
        className={`${styles.input} mt-1`}
        placeholder="0"
      />
      <p className="mt-1 text-xs text-ink-muted">
        + for surplus, − for deficit
      </p>
    </div>

    {/* Proposed target — computed */}
    <div className="rounded-xl border border-emerald p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
        New Calorie Target
      </p>
      <p className="mt-1 text-lg font-bold text-ink">
        {proposedTarget !== null ? `${proposedTarget} kcal` : "-"}
      </p>
      <p className="mt-1 text-xs text-ink-muted">
        TDEE: {proposedTdee !== null ? `${proposedTdee} kcal` : "-"}
      </p>
    </div>
  </div>

  <div className="mt-4 flex items-center gap-3">
    <button
      onClick={handleSaveCalorieTarget}
      disabled={savingTarget || proposedTarget === null}
      className={`${styles.buttonPrimary} disabled:opacity-50`}
    >
      {savingTarget ? "Saving..." : "Save Calorie Target"}
    </button>
    {savedFlash && (
      <span className="text-sm font-medium text-emerald">✓ Saved</span>
    )}
  </div>
</div>

            <div className={`${styles.card} mt-4`}>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="font-semibold text-ink">Weight Trend Review</h3>
                  <p className="mt-1 text-sm text-ink-muted">
                    Coaching prompt only. Peter makes the final decision before
                    changing targets.
                  </p>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${getTrendReviewClasses(
                    weightTrendReview.status
                  )}`}
                >
                  {weightTrendReview.status === "insufficient"
                    ? "Needs data"
                    : weightTrendReview.status === "review"
                      ? "Review"
                      : weightTrendReview.status === "watch"
                        ? "Watch"
                        : "Steady"}
                </span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_2fr]">
                <div className="rounded-xl border border-border-subtle bg-surface-sunken p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                    Weekly trend
                  </p>
                  <p className="mt-1 text-lg font-bold text-ink">
                    {weightTrendReview.weeklyChangeKg !== null
                      ? `${weightTrendReview.weeklyChangeKg > 0 ? "+" : ""}${weightTrendReview.weeklyChangeKg.toFixed(2)} kg/week`
                      : "-"}
                  </p>
                  {weightTrendReview.weeklyChangePct !== null && (
                    <p className="mt-1 text-xs text-ink-muted">
                      {weightTrendReview.weeklyChangePct > 0 ? "+" : ""}
                      {weightTrendReview.weeklyChangePct.toFixed(2)}% bodyweight/week
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-border-subtle bg-surface-sunken p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                    Data used
                  </p>
                  <p className="mt-1 text-lg font-bold text-ink">
                    {weightTrendReview.logsUsed} logs
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {weightTrendReview.daysCovered > 0
                      ? `${weightTrendReview.daysCovered} days covered`
                      : "Waiting for spread of logs"}
                  </p>
                </div>

                <div className="rounded-xl border border-border-subtle bg-surface-sunken p-3">
                  <p className="text-sm font-semibold text-ink">
                    {weightTrendReview.title}
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">
                    {weightTrendReview.detail}
                  </p>
                </div>
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

                  {programHistory.length > 1 && (
                    <div className="mt-4 rounded-xl border border-border-subtle bg-surface-sunken p-3">
                      <p className="text-sm font-semibold text-ink">
                        Programme history
                      </p>
                      <p className="mt-1 text-xs text-ink-muted">
                        Restore a previous programme if a reassignment was made by mistake.
                      </p>

                      <div className="mt-3 space-y-2">
                        {programHistory.map((program) => {
                          const templateName =
                            templates.find(
                              (template) =>
                                template.id === program.program_template_id
                            )?.name ?? "Programme";
                          const isActive = program.id === clientProgram?.id;
                          const createdAt = program.created_at
                            ? new Date(program.created_at).toLocaleDateString(
                                "en-GB",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                }
                              )
                            : "Date unknown";

                          return (
                            <div
                              key={program.id}
                              className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-surface-raised px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div>
                                <p className="text-sm font-medium text-ink">
                                  {templateName}
                                </p>
                                <p className="text-xs text-ink-muted">
                                  {createdAt} - {isActive ? "Active" : program.status ?? "Archived"}
                                </p>
                              </div>

                              {!isActive && (
                                <button
                                  type="button"
                                  onClick={() => handleRestoreProgram(program)}
                                  disabled={restoringProgramId === program.id}
                                  className={styles.buttonSecondary}
                                >
                                  {restoringProgramId === program.id
                                    ? "Restoring..."
                                    : "Restore"}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-end gap-2">
                  {clientProgram && (
                    <Link
                      href={`/trainer/clients/${client.id}/workout`}
                      className={styles.buttonSecondary}
                    >
                      Edit Active Programme
                    </Link>
                  )}
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

          <section>
            <TrainerClientMessages
              clientId={client.id}
              clientName={client.full_name}
            />
          </section>

          <TrainerClientInsights clientId={client.id} />

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

                {photoWeeks.length === 0 ? (
                  <p className="mt-4 text-ink-muted">
                    No progress photos uploaded yet
                  </p>
                ) : (
                  <ProgressPhotoComparison
                    photoWeeks={photoWeeks}
                    showAllWeeks={showAllPhotoWeeks}
                    onShowAllWeeksChange={setShowAllPhotoWeeks}
                    getPhotoUrl={getPhotoUrl}
                    onPhotoClick={(photo, label, weekNumber) =>
                      setEnlargedPhoto({
                        photo: photo as ProgressPhoto,
                        label,
                        weekNumber,
                      })
                    }
                  />
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {enlargedPhoto && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4">
          <div className="relative flex max-h-full w-full max-w-5xl flex-col gap-3">
            <div className="flex items-center justify-between gap-3 text-white">
              <div>
                <p className="text-sm font-semibold">
                  Week {enlargedPhoto.weekNumber} - {enlargedPhoto.label}
                </p>
                <p className="text-xs text-white/70">
                  {enlargedPhoto.photo.log_date}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEnlargedPhoto(null)}
                className="rounded-full bg-white/15 p-2 text-white transition hover:bg-white/25"
                aria-label="Close enlarged photo"
              >
                <X size={20} />
              </button>
            </div>

            <div className="min-h-0 overflow-hidden rounded-xl bg-black">
              <img
                src={getPhotoUrl(enlargedPhoto.photo)}
                alt={`${enlargedPhoto.label} progress photo from ${enlargedPhoto.photo.log_date}`}
                className="max-h-[82vh] w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
