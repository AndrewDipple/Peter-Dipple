"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/PageHeader";
import { styles } from "@/lib/design";
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
};

type MealLog = {
  id: string;
  recipe_id: string;
  completed: boolean;
  quantity: number | null;
  recipes: {
    name: string;
    calories: number | null;
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

function getStatusClasses(status: "green" | "amber" | "red") {
  if (status === "green") return "border-green-200 bg-green-50 text-green-700";
  if (status === "amber") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-red-200 bg-red-50 text-red-700";
}

useEffect(() => {
  const checkRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "trainer") {
      window.location.href = "/client/dashboard";
    }
  };

  checkRole();
}, []);

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
        .order("log_date", { ascending: false })
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
      setSetLogs([]);
      setDayExercises([]);
      setReviewedDayId(null);

      let recipeCaloriesTotal = 0;
      let customCaloriesTotal = 0;

      const { data: mealData } = await supabase
        .from("meal_logs")
        .select("id, recipe_id, completed, quantity, recipes(name, calories)")
        .eq("client_id", clientId)
        .eq("log_date", selectedDate)
        .eq("completed", true);

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
              ? { name: recipeData.name ?? "", calories: recipeData.calories ?? null }
              : null,
          };
        });

        setMealLogs(normalizedMealLogs);

        recipeCaloriesTotal = normalizedMealLogs.reduce((sum, item) => {
          const quantity = item.quantity ?? 1;
          return sum + (item.recipes?.calories ?? 0) * quantity;
        }, 0);
      }

      const { data: customMealData } = await supabase
        .from("custom_meal_logs")
        .select("*")
        .eq("client_id", clientId)
        .eq("log_date", selectedDate)
        .order("created_at", { ascending: false });

      if (customMealData) {
        setCustomMealLogs(customMealData);
        customCaloriesTotal = customMealData.reduce(
          (sum, meal) => sum + (meal.calories ?? 0),
          0
        );
      }

      setTodayCalories(recipeCaloriesTotal + customCaloriesTotal);

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
  }, [selectedDate, clientId, clientProgram, programDays]);

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
    alert("Template assigned!");
    setClientProgram(newProgram);
    setAssigningTemplate(false);
  };

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  return (
    <main className={styles.page}>
      <div className="mx-auto max-w-6xl rounded-2xl bg-white p-6 shadow">
        <PageHeader
          title="Client Detail"
          backHref="/trainer/clients"
          showTrainerNav
        />

        {loading ? (
          <p className={styles.body}>Loading...</p>
        ) : !client ? (
          <p className={styles.body}>Client not found</p>
        ) : (
          <div className="space-y-6">
            <div className={styles.card}>
              <h2 className="text-xl font-semibold text-[#111111]">
                {client.full_name}
              </h2>
              <p className="mt-1 text-[#2B2B2B]">{client.email}</p>
            </div>

            <div className={styles.card}>
              <h3 className="font-semibold text-[#111111]">Latest Weight</h3>
              <p className="mt-2 text-lg font-semibold text-[#111111]">
                {latestWeight ? `${latestWeight.weight_kg} kg` : "No weight logged yet"}
              </p>
              {latestWeight && (
                <p className="mt-1 text-sm text-[#2B2B2B]">
                  Logged on {latestWeight.log_date}
                </p>
              )}

              <div className="mt-6">
                <h4 className="mb-3 text-sm font-medium text-[#111111]">
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
                      className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
                    >
                      <span className="text-sm text-[#2B2B2B]">{log.log_date}</span>
                      <span className="font-medium text-[#111111]">
                        {log.weight_kg} kg
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className={styles.card}>
              <h3 className="font-semibold text-[#111111]">Latest Measurements</h3>
              <p className="mt-2 text-sm text-[#2B2B2B]">
                Latest waist:{" "}
                {latestMeasurements?.waist_cm !== null &&
                latestMeasurements?.waist_cm !== undefined
                  ? `${latestMeasurements.waist_cm} cm`
                  : "No measurements logged yet"}
              </p>
              {latestMeasurements && (
                <p className="mt-1 text-sm text-[#2B2B2B]">
                  Logged on {latestMeasurements.log_date}
                </p>
              )}

              <div className="mt-6">
                <h4 className="mb-3 text-sm font-medium text-[#111111]">
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
                      className="rounded-lg border border-slate-200 px-3 py-2"
                    >
                      <p className="text-sm font-medium text-[#111111]">
                        {log.log_date}
                      </p>
                      <p className="text-sm text-[#2B2B2B]">
                        Waist: {log.waist_cm ?? "-"} cm • Hips: {log.hips_cm ?? "-"} cm •
                        Chest: {log.chest_cm ?? "-"} cm
                      </p>
                      <p className="text-sm text-[#2B2B2B]">
                        Arms: {log.left_arm_cm ?? "-"} / {log.right_arm_cm ?? "-"} cm •
                        Thighs: {log.left_thigh_cm ?? "-"} / {log.right_thigh_cm ?? "-"} cm
                      </p>
                      {log.note && (
                        <p className="text-sm text-[#2B2B2B]">{log.note}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className={styles.card}>
              <h3 className="font-semibold text-[#111111]">Progress Photos</h3>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {progressPhotos.length === 0 ? (
                  <p className="text-slate-500">No progress photos uploaded yet</p>
                ) : (
                  progressPhotos.map((photo) => (
                    <div key={photo.id} className={`${styles.card} p-3`}>
                      <img
                        src={photo.image_url}
                        alt="Progress"
                        className="h-56 w-full rounded-xl object-cover"
                      />
                      <p className="mt-2 text-sm font-medium text-[#111111]">
                        {photo.log_date}
                      </p>
                      {photo.note && (
                        <p className="mt-1 text-sm text-[#2B2B2B]">{photo.note}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className={styles.card}>
              <h3 className="font-semibold text-[#111111]">Programme Assignment</h3>

              <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
                <div>
                  <label className="text-sm font-medium text-[#111111]">
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
                    <p className="mt-2 text-sm text-[#2B2B2B]">
                      {selectedTemplate.duration_weeks ?? "-"} weeks •{" "}
                      {selectedTemplate.days_per_week ?? "-"} days per week
                    </p>
                  )}

                  {clientProgram && (
                    <p className="mt-2 text-sm text-[#2B2B2B]">
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

            <div className={styles.card}>
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <h3 className="font-semibold text-[#111111]">Daily Review</h3>
                  <p className="mt-1 text-sm text-[#2B2B2B]">{readableDate}</p>
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

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className={`rounded-xl border p-4 ${getStatusClasses(workoutStatus.status)}`}>
                  <p className="text-xs font-medium uppercase tracking-wide">
                    Workout
                  </p>
                  <p className="mt-1 text-sm font-semibold">{workoutStatus.label}</p>
                </div>

                <div className={`rounded-xl border p-4 ${getStatusClasses(nutritionStatus.status)}`}>
                  <p className="text-xs font-medium uppercase tracking-wide">
                    Nutrition
                  </p>
                  <p className="mt-1 text-sm font-semibold">{nutritionStatus.label}</p>
                </div>
              </div>
            </div>

            <div className={styles.card}>
              <h3 className="font-semibold text-[#111111]">Meals Logged</h3>

              <div className="mt-4 rounded-xl bg-[#F2F2F2] p-4">
                <p className="text-sm text-[#2B2B2B]">Total Calories</p>
                <p className="text-2xl font-bold text-[#111111]">
                  {todayCalories} kcal
                </p>
                <p className="text-sm text-[#2B2B2B]">{selectedDate}</p>
              </div>

              <div className="mt-4 space-y-2">
                {mealLogs.length === 0 ? (
                  <p className="text-slate-500">No recipe meals logged for this day</p>
                ) : (
                  mealLogs.map((meal) => {
                    const quantity = meal.quantity ?? 1;
                    const caloriesPerMeal = meal.recipes?.calories ?? 0;
                    const totalMealCalories = caloriesPerMeal * quantity;

                    return (
                      <div
                        key={meal.id}
                        className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
                      >
                        <div>
                          <span className="font-medium text-slate-900">
                            {meal.recipes?.name || "Unnamed meal"}
                          </span>
                          <p className="text-sm text-slate-700">
                            Quantity: {quantity}
                          </p>
                        </div>

                        <span className="text-sm text-slate-800">
                          {totalMealCalories} kcal
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className={styles.card}>
              <h3 className="font-semibold text-[#111111]">Custom Meals Logged</h3>

              <div className="mt-4 space-y-2">
                {customMealLogs.length === 0 ? (
                  <p className="text-slate-500">No custom meals logged for this day</p>
                ) : (
                  customMealLogs.map((meal) => (
                    <div
                      key={meal.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
                    >
                      <div>
                        <span className="font-medium text-slate-900">
                          {meal.meal_name}
                        </span>
                        {meal.note && (
                          <p className="text-sm text-slate-700">{meal.note}</p>
                        )}
                      </div>

                      <span className="text-sm text-slate-800">
                        {meal.calories} kcal
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className={styles.card}>
              <h3 className="font-semibold text-[#111111]">Workout Logs</h3>

              <div className="mt-4 space-y-2">
                {setLogs.length === 0 ? (
                  <p className="text-slate-500">No workout activity logged for this day</p>
                ) : (
                  setLogs.map((log) => {
                    const exercise = dayExercises.find(
                      (e) => e.id === log.client_program_day_exercise_id
                    );

                    return (
                      <div
                        key={log.id}
                        className="rounded-lg border border-slate-200 px-3 py-2"
                      >
                        <p className="font-medium text-slate-900">
                          {exercise?.exercise_name || "Exercise"}
                        </p>
                        <p className="text-sm text-slate-700">
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
        )}
      </div>
    </main>
  );
}