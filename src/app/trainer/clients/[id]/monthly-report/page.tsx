"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Printer } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";
import { addDays, formatLongDate, todayStr } from "@/lib/dates";
import { withSignedProgressPhotoUrls } from "@/lib/privateStorage";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type Client = {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
  calorie_target: number | null;
  daily_step_target: number | null;
  training_days_per_week: number | null;
};

type WeightLog = {
  id: string;
  weight_kg: number;
  log_date: string;
};

type MeasurementLog = {
  id: string;
  log_date: string;
  waist_cm: number | null;
  hips_cm: number | null;
  chest_cm: number | null;
};

type WorkoutCompletion = {
  id: string;
  completed_date: string;
};

type DailyTracking = {
  log_date: string;
  steps_logged: number | null;
  water_completed: boolean | null;
};

type MealLog = {
  log_date: string;
  quantity: number | null;
  recipes:
    | {
        calories: number | null;
      }
    | {
        calories: number | null;
      }[]
    | null;
};

type CustomMealLog = {
  log_date: string;
  calories: number | null;
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

type WeeklyCheckIn = {
  week_start: string;
  weight_kg: number | null;
  energy_level: number | null;
  hunger_level: number | null;
  motivation_level: number | null;
  soreness_level: number | null;
  sleep_quality: number | null;
  notes: string | null;
};

const toDateStr = (date: Date) => date.toISOString().split("T")[0];

const getDaysBetween = (start: string, end: string) => {
  const result: string[] = [];
  let current = start;

  while (current <= end) {
    result.push(current);
    current = addDays(current, 1);
  }

  return result;
};

const getRecipeCalories = (meal: MealLog) => {
  const recipe = Array.isArray(meal.recipes)
    ? meal.recipes[0] ?? null
    : meal.recipes;

  return (recipe?.calories ?? 0) * (meal.quantity ?? 1);
};

const formatDelta = (value: number, unit: string) => {
  if (value === 0) return `No change ${unit}`;
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}${unit}`;
};

const formatValue = (value: number | null | undefined, unit: string) =>
  typeof value === "number" ? `${value}${unit}` : "-";

export default function MonthlyClientReportPage({ params }: PageProps) {
  const [clientId, setClientId] = useState("");
  const [client, setClient] = useState<Client | null>(null);
  const [weights, setWeights] = useState<WeightLog[]>([]);
  const [comparisonWeights, setComparisonWeights] = useState<WeightLog[]>([]);
  const [measurements, setMeasurements] = useState<MeasurementLog[]>([]);
  const [comparisonMeasurements, setComparisonMeasurements] = useState<
    MeasurementLog[]
  >([]);
  const [workouts, setWorkouts] = useState<WorkoutCompletion[]>([]);
  const [dailyTracking, setDailyTracking] = useState<DailyTracking[]>([]);
  const [mealLogs, setMealLogs] = useState<MealLog[]>([]);
  const [customMealLogs, setCustomMealLogs] = useState<CustomMealLog[]>([]);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [comparisonPhotos, setComparisonPhotos] = useState<ProgressPhoto[]>([]);
  const [checkIns, setCheckIns] = useState<WeeklyCheckIn[]>([]);
  const [reportStart, setReportStart] = useState(() => addDays(todayStr(), -27));
  const [reportEnd, setReportEnd] = useState(() => todayStr());
  const [goals, setGoals] = useState("");
  const [loading, setLoading] = useState(true);

  const reportDays = useMemo(
    () => getDaysBetween(reportStart, reportEnd),
    [reportStart, reportEnd]
  );
  const reportLabel = useMemo(
    () => `${formatLongDate(reportStart)} to ${formatLongDate(reportEnd)}`,
    [reportStart, reportEnd]
  );

  useEffect(() => {
    const resolveParams = async () => {
      const resolved = await params;
      setClientId(resolved.id);
    };

    resolveParams();
  }, [params]);

  useEffect(() => {
    if (!clientId) return;

    const loadReport = async () => {
      setLoading(true);

      const [
        clientRes,
        weightRes,
        measurementRes,
        workoutRes,
        trackingRes,
        mealRes,
        customMealRes,
        photoRes,
        checkInRes,
        comparisonWeightRes,
        comparisonMeasurementRes,
        comparisonPhotoRes,
      ] = await Promise.all([
        supabase
          .from("clients")
          .select(
            "id, full_name, email, created_at, calorie_target, daily_step_target, training_days_per_week"
          )
          .eq("id", clientId)
          .maybeSingle(),
        supabase
          .from("client_weight_logs")
          .select("id, weight_kg, log_date")
          .eq("client_id", clientId)
          .gte("log_date", reportStart)
          .lte("log_date", reportEnd)
          .order("log_date", { ascending: true }),
        supabase
          .from("client_measurement_logs")
          .select("id, log_date, waist_cm, hips_cm, chest_cm")
          .eq("client_id", clientId)
          .gte("log_date", reportStart)
          .lte("log_date", reportEnd)
          .order("log_date", { ascending: true }),
        supabase
          .from("client_workout_completions")
          .select("id, completed_date")
          .eq("client_id", clientId)
          .gte("completed_date", reportStart)
          .lte("completed_date", reportEnd)
          .order("completed_date", { ascending: true }),
        supabase
          .from("daily_tracking")
          .select("log_date, steps_logged, water_completed")
          .eq("client_id", clientId)
          .gte("log_date", reportStart)
          .lte("log_date", reportEnd)
          .order("log_date", { ascending: true }),
        supabase
          .from("meal_logs")
          .select("log_date, quantity, recipes(calories)")
          .eq("client_id", clientId)
          .eq("completed", true)
          .gte("log_date", reportStart)
          .lte("log_date", reportEnd),
        supabase
          .from("custom_meal_logs")
          .select("log_date, calories")
          .eq("client_id", clientId)
          .gte("log_date", reportStart)
          .lte("log_date", reportEnd),
        supabase
          .from("progress_photos")
          .select("id, image_url, storage_path, log_date, note, photo_type")
          .eq("client_id", clientId)
          .gte("log_date", reportStart)
          .lte("log_date", reportEnd)
          .order("log_date", { ascending: true }),
        supabase
          .from("client_weekly_check_ins")
          .select(
            "week_start, weight_kg, energy_level, hunger_level, motivation_level, soreness_level, sleep_quality, notes"
          )
          .eq("client_id", clientId)
          .gte("week_start", reportStart)
          .lte("week_start", reportEnd)
          .order("week_start", { ascending: true }),
        supabase
          .from("client_weight_logs")
          .select("id, weight_kg, log_date")
          .eq("client_id", clientId)
          .lte("log_date", reportEnd)
          .order("log_date", { ascending: true }),
        supabase
          .from("client_measurement_logs")
          .select("id, log_date, waist_cm, hips_cm, chest_cm")
          .eq("client_id", clientId)
          .lte("log_date", reportEnd)
          .order("log_date", { ascending: true }),
        supabase
          .from("progress_photos")
          .select("id, image_url, storage_path, log_date, note, photo_type")
          .eq("client_id", clientId)
          .lte("log_date", reportEnd)
          .order("log_date", { ascending: true }),
      ]);

      setClient((clientRes.data ?? null) as Client | null);
      setWeights((weightRes.data ?? []) as WeightLog[]);
      setComparisonWeights((comparisonWeightRes.data ?? []) as WeightLog[]);
      setMeasurements((measurementRes.data ?? []) as MeasurementLog[]);
      setComparisonMeasurements(
        (comparisonMeasurementRes.data ?? []) as MeasurementLog[]
      );
      setWorkouts((workoutRes.data ?? []) as WorkoutCompletion[]);
      setDailyTracking((trackingRes.data ?? []) as DailyTracking[]);
      setMealLogs((mealRes.data ?? []) as MealLog[]);
      setCustomMealLogs((customMealRes.data ?? []) as CustomMealLog[]);
      setPhotos(
        await withSignedProgressPhotoUrls(
          (photoRes.data ?? []) as ProgressPhoto[]
        )
      );
      setComparisonPhotos(
        await withSignedProgressPhotoUrls(
          (comparisonPhotoRes.data ?? []) as ProgressPhoto[]
        )
      );
      setCheckIns((checkInRes.data ?? []) as WeeklyCheckIn[]);
      setLoading(false);
    };

    loadReport();
  }, [clientId, reportStart, reportEnd]);

  const caloriesByDate = useMemo(() => {
    const totals = new Map<string, number>();

    mealLogs.forEach((meal) => {
      totals.set(meal.log_date, (totals.get(meal.log_date) ?? 0) + getRecipeCalories(meal));
    });

    customMealLogs.forEach((meal) => {
      totals.set(meal.log_date, (totals.get(meal.log_date) ?? 0) + (meal.calories ?? 0));
    });

    return totals;
  }, [customMealLogs, mealLogs]);

  const totalCalories = [...caloriesByDate.values()].reduce(
    (sum, value) => sum + value,
    0
  );
  const loggedNutritionDays = [...caloriesByDate.values()].filter(
    (value) => value > 0
  ).length;
  const calorieTarget = client?.calorie_target ?? null;
  const expectedCalories = calorieTarget ? calorieTarget * reportDays.length : null;
  const calorieDifference =
    expectedCalories !== null ? Math.round(totalCalories - expectedCalories) : null;
  const averageDailyDifference =
    calorieDifference !== null
      ? Math.round(calorieDifference / reportDays.length)
      : null;

  const weightDelta =
    weights.length >= 2
      ? Number(weights[weights.length - 1].weight_kg) - Number(weights[0].weight_kg)
      : null;
  const baselineWeight = comparisonWeights[0] ?? null;
  const currentWeight = comparisonWeights.at(-1) ?? null;
  const comparisonWeightDelta =
    baselineWeight && currentWeight
      ? Number(currentWeight.weight_kg) - Number(baselineWeight.weight_kg)
      : null;
  const waistLogs = measurements.filter((log) => log.waist_cm !== null);
  const waistDelta =
    waistLogs.length >= 2
      ? Number(waistLogs[waistLogs.length - 1].waist_cm) -
        Number(waistLogs[0].waist_cm)
      : null;
  const baselineMeasurements = comparisonMeasurements[0] ?? null;
  const currentMeasurements = comparisonMeasurements.at(-1) ?? null;
  const comparisonMeasurementDelta = (
    key: keyof Pick<MeasurementLog, "waist_cm" | "hips_cm" | "chest_cm">
  ) => {
    const baseline = baselineMeasurements?.[key];
    const current = currentMeasurements?.[key];

    if (typeof baseline !== "number" || typeof current !== "number") return null;
    return current - baseline;
  };

  const expectedWorkouts = client?.training_days_per_week
    ? Math.max(1, Math.round((reportDays.length / 7) * client.training_days_per_week))
    : null;
  const workoutProgress =
    expectedWorkouts !== null
      ? Math.min(100, Math.round((workouts.length / expectedWorkouts) * 100))
      : null;

  const trackingByDate = new Map(
    dailyTracking.map((item) => [item.log_date, item])
  );
  const averageSteps =
    dailyTracking.length > 0
      ? Math.round(
          dailyTracking.reduce((sum, day) => sum + (day.steps_logged ?? 0), 0) /
            dailyTracking.length
        )
      : null;
  const waterDays = dailyTracking.filter((day) => day.water_completed).length;

  const dailyChartData = reportDays.map((date) => ({
    date: date.slice(5),
    calories: Math.round(caloriesByDate.get(date) ?? 0),
    steps: trackingByDate.get(date)?.steps_logged ?? 0,
  }));

  const firstPhotosByType = new Map<string, ProgressPhoto>();
  const latestPhotosByType = new Map<string, ProgressPhoto>();
  photos.forEach((photo) => {
    if (!firstPhotosByType.has(photo.photo_type)) {
      firstPhotosByType.set(photo.photo_type, photo);
    }
    latestPhotosByType.set(photo.photo_type, photo);
  });
  const photoTypes = ["front", "side", "back"] as const;
  const baselineComparisonPhotosByType = new Map<string, ProgressPhoto>();
  const currentComparisonPhotosByType = new Map<string, ProgressPhoto>();
  comparisonPhotos.forEach((photo) => {
    if (!baselineComparisonPhotosByType.has(photo.photo_type)) {
      baselineComparisonPhotosByType.set(photo.photo_type, photo);
    }
    currentComparisonPhotosByType.set(photo.photo_type, photo);
  });

  const checkInAverage = (key: keyof WeeklyCheckIn) => {
    const values = checkIns
      .map((checkIn) => checkIn[key])
      .filter((value): value is number => typeof value === "number");

    if (values.length === 0) return "-";
    return (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1);
  };

  const setPresetRange = (days: number) => {
    const end = todayStr();
    setReportStart(addDays(end, -(days - 1)));
    setReportEnd(end);
  };

  const setAllTimeRange = () => {
    const start = client?.created_at?.split("T")[0] ?? reportStart;
    setReportStart(start);
    setReportEnd(todayStr());
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 print:max-w-none print:space-y-4">
      <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={clientId ? `/trainer/clients/${clientId}` : "/trainer/clients"}
          className={styles.buttonSecondary}
        >
          Back to client
        </Link>

        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm font-medium text-ink">
            From
            <input
              type="date"
              value={reportStart}
              max={reportEnd}
              onChange={(event) => setReportStart(event.target.value)}
              className={styles.input}
            />
          </label>
          <label className="text-sm font-medium text-ink">
            To
            <input
              type="date"
              value={reportEnd}
              min={reportStart}
              max={todayStr()}
              onChange={(event) => setReportEnd(event.target.value)}
              className={styles.input}
            />
          </label>
          <button
            type="button"
            onClick={() => setPresetRange(7)}
            className={styles.buttonSecondary}
          >
            Last 7 days
          </button>
          <button
            type="button"
            onClick={() => setPresetRange(14)}
            className={styles.buttonSecondary}
          >
            Last 14 days
          </button>
          <button
            type="button"
            onClick={() => setPresetRange(28)}
            className={styles.buttonSecondary}
          >
            Last 28 days
          </button>
          <button
            type="button"
            onClick={setAllTimeRange}
            className={styles.buttonSecondary}
          >
            All time
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className={`${styles.buttonPrimary} inline-flex items-center gap-2`}
          >
            <Printer size={16} />
            Print / Save PDF
          </button>
        </div>
      </div>

      <section className="rounded-xl border border-border-subtle bg-surface p-6 shadow-subtle print:border-0 print:shadow-none">
        <div className="flex flex-col gap-4 border-b border-border-subtle pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-gold">
              Progress Report
            </p>
            <h1 className="mt-1 text-3xl font-bold text-ink">
              {client?.full_name ?? "Client"}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              {reportLabel}
            </p>
          </div>
          <div className="text-left text-sm text-ink-muted sm:text-right">
            <p>Peter Dipple Coaching</p>
            <p>{client?.email}</p>
          </div>
        </div>

        {loading ? (
          <p className={`${styles.body} mt-6`}>Loading report...</p>
        ) : !client ? (
          <p className={`${styles.body} mt-6`}>Client not found.</p>
        ) : (
          <div className="mt-6 space-y-8">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-border-subtle p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Workouts
                </p>
                <p className="mt-2 text-2xl font-bold text-ink">
                  {workouts.length}
                  {expectedWorkouts !== null ? `/${expectedWorkouts}` : ""}
                </p>
                <p className="mt-1 text-sm text-ink-muted">
                  {workoutProgress !== null
                    ? `${workoutProgress}% of expected`
                    : "Completed in this range"}
                </p>
              </div>
              <div className="rounded-lg border border-border-subtle p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Weight change
                </p>
                <p className="mt-2 text-2xl font-bold text-ink">
                  {weightDelta !== null ? formatDelta(weightDelta, "kg") : "-"}
                </p>
                <p className="mt-1 text-sm text-ink-muted">
                  {weights.length} weight log{weights.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="rounded-lg border border-border-subtle p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Nutrition
                </p>
                <p className="mt-2 text-2xl font-bold text-ink">
                  {loggedNutritionDays}/{reportDays.length}
                </p>
                <p className="mt-1 text-sm text-ink-muted">days logged</p>
              </div>
              <div className="rounded-lg border border-border-subtle p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Steps
                </p>
                <p className="mt-2 text-2xl font-bold text-ink">
                  {averageSteps?.toLocaleString() ?? "-"}
                </p>
                <p className="mt-1 text-sm text-ink-muted">average per logged day</p>
              </div>
            </div>

            <section>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-ink">
                    Day 1 vs Current
                  </h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    Earliest available baseline compared with the latest data up
                    to {formatLongDate(reportEnd)}.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-border-subtle p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Weight
                  </p>
                  <p className="mt-2 text-2xl font-bold text-ink">
                    {comparisonWeightDelta !== null
                      ? formatDelta(comparisonWeightDelta, "kg")
                      : "-"}
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">
                    {baselineWeight
                      ? `${baselineWeight.weight_kg}kg on ${baselineWeight.log_date}`
                      : "No baseline"}
                    {currentWeight
                      ? ` → ${currentWeight.weight_kg}kg on ${currentWeight.log_date}`
                      : ""}
                  </p>
                </div>
              </div>

              {comparisonPhotos.length > 0 && (
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  {photoTypes.map((type) => {
                    const baselinePhoto = baselineComparisonPhotosByType.get(type);
                    const currentPhoto = currentComparisonPhotosByType.get(type);

                    return (
                      <div
                        key={`comparison-${type}`}
                        className="rounded-lg border border-border-subtle p-3"
                      >
                        <p className="text-sm font-semibold capitalize text-ink">
                          {type} photos
                        </p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {[baselinePhoto, currentPhoto].map((photo, index) => (
                            <div key={`${type}-comparison-${index}`}>
                              <p className="mb-1 text-xs text-ink-muted">
                                {index === 0 ? "Day 1" : "Current"}
                              </p>
                              {photo?.signed_url ? (
                                <img
                                  src={photo.signed_url}
                                  alt={`${type} ${index === 0 ? "day 1" : "current"}`}
                                  className="aspect-[3/4] w-full rounded-md object-cover"
                                />
                              ) : (
                                <div className="flex aspect-[3/4] items-center justify-center rounded-md bg-surface-sunken text-xs text-ink-muted">
                                  No photo
                                </div>
                              )}
                              {photo && (
                                <p className="mt-1 text-xs text-ink-muted">
                                  {photo.log_date}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <section>
                <h2 className="text-xl font-semibold text-ink">
                  Weight and Measurements
                </h2>
                <div className="mt-4 h-56 rounded-lg border border-border-subtle p-3">
                  {weights.length >= 2 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={weights}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="log_date" />
                        <YAxis domain={["dataMin - 1", "dataMax + 1"]} />
                        <Tooltip />
                        <Line
                          dataKey="weight_kg"
                          name="Weight kg"
                          stroke="#b88a2e"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className={styles.body}>
                      Not enough weight logs for a chart yet.
                    </p>
                  )}
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-surface-sunken p-3">
                    <p className="text-sm font-semibold text-ink">Waist change</p>
                    <p className="mt-1 text-sm text-ink-muted">
                      {waistDelta !== null ? formatDelta(waistDelta, "cm") : "-"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-surface-sunken p-3">
                    <p className="text-sm font-semibold text-ink">Latest check-in weight</p>
                    <p className="mt-1 text-sm text-ink-muted">
                      {checkIns.at(-1)?.weight_kg
                        ? `${checkIns.at(-1)?.weight_kg}kg`
                        : "-"}
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-ink">
                  Nutrition Adherence
                </h2>
                <div className="mt-4 h-56 rounded-lg border border-border-subtle p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="calories" name="Calories" fill="#2f5d50" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 rounded-lg bg-surface-sunken p-3 text-sm text-ink-muted">
                  <p>
                    Consumed {Math.round(totalCalories).toLocaleString()} kcal
                    {expectedCalories !== null
                      ? ` against ${expectedCalories.toLocaleString()} kcal target`
                      : ""}.
                  </p>
                  {calorieDifference !== null && (
                    <p className="mt-1">
                      Total difference: {calorieDifference > 0 ? "+" : ""}
                      {calorieDifference.toLocaleString()} kcal. Average daily
                      difference: {averageDailyDifference && averageDailyDifference > 0 ? "+" : ""}
                      {averageDailyDifference?.toLocaleString()} kcal.
                    </p>
                  )}
                </div>
              </section>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <section>
                <h2 className="text-xl font-semibold text-ink">
                  Workout Consistency
                </h2>
                <div className="mt-4 rounded-lg border border-border-subtle p-4">
                  <p className="text-3xl font-bold text-ink">
                    {workouts.length}
                    {expectedWorkouts !== null ? `/${expectedWorkouts}` : ""}
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">
                    completed workout{workouts.length === 1 ? "" : "s"} in this report period
                  </p>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-sunken">
                    <div
                      className="h-full rounded-full bg-gold"
                      style={{ width: `${workoutProgress ?? 0}%` }}
                    />
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-ink">
                  Weekly Check-In Averages
                </h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-5">
                  {[
                    ["Energy", "energy_level"],
                    ["Hunger", "hunger_level"],
                    ["Motivation", "motivation_level"],
                    ["Soreness", "soreness_level"],
                    ["Sleep", "sleep_quality"],
                  ].map(([label, key]) => (
                    <div
                      key={key}
                      className="rounded-lg border border-border-subtle p-3 text-center"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                        {label}
                      </p>
                      <p className="mt-2 text-xl font-bold text-ink">
                        {checkInAverage(key as keyof WeeklyCheckIn)}
                      </p>
                    </div>
                  ))}
                </div>
                {checkIns.length > 0 && (
                  <div className="mt-4 rounded-lg bg-surface-sunken p-3 text-sm text-ink-muted">
                    <p className="font-semibold text-ink">Latest note</p>
                    <p className="mt-1">{checkIns.at(-1)?.notes || "No note added."}</p>
                  </div>
                )}
              </section>
            </div>

            <section>
              <h2 className="text-xl font-semibold text-ink">
                Progress Photos
              </h2>
              {photos.length === 0 ? (
                <p className={`${styles.body} mt-3`}>
                  No progress photos uploaded in this report period.
                </p>
              ) : (
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  {photoTypes.map((type) => {
                    const firstPhoto = firstPhotosByType.get(type);
                    const latestPhoto = latestPhotosByType.get(type);

                    return (
                      <div
                        key={type}
                        className="rounded-lg border border-border-subtle p-3"
                      >
                        <p className="text-sm font-semibold capitalize text-ink">
                          {type}
                        </p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {[firstPhoto, latestPhoto].map((photo, index) => (
                            <div key={`${type}-${index}`}>
                              <p className="mb-1 text-xs text-ink-muted">
                                {index === 0 ? "First" : "Latest"}
                              </p>
                              {photo?.signed_url ? (
                                <img
                                  src={photo.signed_url}
                                  alt={`${type} progress ${index === 0 ? "first" : "latest"}`}
                                  className="aspect-[3/4] w-full rounded-md object-cover"
                                />
                              ) : (
                                <div className="flex aspect-[3/4] items-center justify-center rounded-md bg-surface-sunken text-xs text-ink-muted">
                                  No photo
                                </div>
                              )}
                              {photo && (
                                <p className="mt-1 text-xs text-ink-muted">
                                  {photo.log_date}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-xl font-semibold text-ink">
                Optional Measurements
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                Day 1 comparison for optional body measurements.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {[
                  ["Waist", "waist_cm"],
                  ["Hips", "hips_cm"],
                  ["Chest", "chest_cm"],
                ].map(([label, key]) => {
                  const typedKey = key as keyof Pick<
                    MeasurementLog,
                    "waist_cm" | "hips_cm" | "chest_cm"
                  >;
                  const delta = comparisonMeasurementDelta(typedKey);

                  return (
                    <div
                      key={key}
                      className="rounded-lg border border-border-subtle p-4"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                        {label}
                      </p>
                      <p className="mt-2 text-2xl font-bold text-ink">
                        {delta !== null ? formatDelta(delta, "cm") : "-"}
                      </p>
                      <p className="mt-1 text-sm text-ink-muted">
                        {baselineMeasurements
                          ? `${formatValue(
                              baselineMeasurements[typedKey],
                              "cm"
                            )} on ${baselineMeasurements.log_date}`
                          : "No baseline"}
                        {currentMeasurements
                          ? ` → ${formatValue(
                              currentMeasurements[typedKey],
                              "cm"
                            )} on ${currentMeasurements.log_date}`
                          : ""}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>

            <section>
                <h2 className="text-xl font-semibold text-ink">Next Focus</h2>
              <textarea
                value={goals}
                onChange={(event) => setGoals(event.target.value)}
                className={`${styles.textarea} mt-3 min-h-28 print:border-0 print:bg-white`}
                placeholder="Add focus points, targets, programme changes, or coaching notes before printing."
              />
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
