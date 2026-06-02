"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "@/lib/supabase";
import { addDays, getSundayOf, todayStr } from "@/lib/dates";
import { styles } from "@/lib/design";

type ClientProgramDay = {
  id: string;
  day_name: string | null;
};

type WeeklyCheckIn = {
  id: string;
  client_id: string;
  week_start: string;
  energy_level: number;
  hunger_level: number;
  motivation_level: number;
  soreness_level: number;
  sleep_quality: number;
  notes: string | null;
  submitted_at: string;
};

type WorkoutCompletion = {
  id: string;
  client_program_day_id: string;
  completed_date: string;
  completed_at: string | null;
};

type ClientMessage = {
  id: string;
  sender_role: "client" | "trainer";
  body: string;
  context_label: string | null;
  read_by_trainer_at: string | null;
  created_at: string;
};

type WeightLog = {
  id: string;
  weight_kg: number;
  log_date: string;
  note: string | null;
};

type ProgressPhoto = {
  id: string;
  image_url: string;
  log_date: string;
  note: string | null;
};

type CalorieWeekSummary = {
  weekStart: string;
  weekEnd: string;
  consumed: number;
  target: number | null;
  difference: number | null;
  averageDailyDifference: number | null;
};

type MealLogCalorieRow = {
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

type TimelineItem = {
  key: string;
  date: string;
  title: string;
  detail: string;
  tone: "workout" | "checkin" | "message" | "weight" | "photo";
};

type TrainerClientInsightsProps = {
  clientId: string;
};

const toneClasses: Record<TimelineItem["tone"], string> = {
  workout: "border-navy/20 bg-navy/5",
  checkin: "border-gold/30 bg-gold/10",
  message: "border-blue-200 bg-blue-50",
  weight: "border-emerald/20 bg-emerald/5",
  photo: "border-purple-200 bg-purple-50",
};

const formatDate = (dateStr: string) =>
  new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });

const formatDelta = (delta: number) => {
  if (delta === 0) return "no change";
  return `${delta > 0 ? "+" : ""}${delta.toFixed(1)}kg`;
};

const formatKcal = (value: number) => `${Math.round(value).toLocaleString()} kcal`;

const formatKcalDifference = (value: number | null) => {
  if (value === null) return "-";
  if (value === 0) return "On target";

  const amount = formatKcal(Math.abs(value));
  return value > 0 ? `${amount} over` : `${amount} under`;
};

const describeLevel = (value: number, lowLabel: string, highLabel: string) => {
  if (value <= 2) return lowLabel;
  if (value >= 4) return highLabel;
  return "steady";
};

export default function TrainerClientInsights({ clientId }: TrainerClientInsightsProps) {
  const [programDays, setProgramDays] = useState<ClientProgramDay[]>([]);
  const [checkIns, setCheckIns] = useState<WeeklyCheckIn[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutCompletion[]>([]);
  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [weights, setWeights] = useState<WeightLog[]>([]);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [calorieSummaries, setCalorieSummaries] = useState<
    Record<string, CalorieWeekSummary>
  >({});
  const [loading, setLoading] = useState(true);

  const today = useMemo(() => todayStr(), []);
  const weekStart = useMemo(() => getSundayOf(today), [today]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  useEffect(() => {
    const loadInsights = async () => {
      setLoading(true);

      const [
        clientRes,
        checkInRes,
        workoutRes,
        messageRes,
        weightRes,
        photoRes,
      ] = await Promise.all([
        supabase
          .from("clients")
          .select("calorie_target")
          .eq("id", clientId)
          .maybeSingle(),
        supabase
          .from("client_weekly_check_ins")
          .select("*")
          .eq("client_id", clientId)
          .order("week_start", { ascending: false })
          .limit(12),
        supabase
          .from("client_workout_completions")
          .select("id, client_program_day_id, completed_date, completed_at")
          .eq("client_id", clientId)
          .order("completed_date", { ascending: false })
          .limit(90),
        supabase
          .from("client_messages")
          .select("id, sender_role, body, context_label, read_by_trainer_at, created_at")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("client_weight_logs")
          .select("id, weight_kg, log_date, note")
          .eq("client_id", clientId)
          .order("log_date", { ascending: false })
          .limit(12),
        supabase
          .from("progress_photos")
          .select("id, image_url, log_date, note")
          .eq("client_id", clientId)
          .order("log_date", { ascending: false })
          .limit(8),
      ]);

      const loadedCheckIns = (checkInRes.data ?? []) as WeeklyCheckIn[];
      const dailyCalorieTarget = clientRes.data?.calorie_target ?? null;
      const loadedWorkouts = (workoutRes.data ?? []) as WorkoutCompletion[];
      const completedDayIds = [
        ...new Set(
          loadedWorkouts
            .map((workout) => workout.client_program_day_id)
            .filter(Boolean)
        ),
      ];

      if (completedDayIds.length > 0) {
        const { data: daysData } = await supabase
          .from("client_program_days")
          .select("id, day_name")
          .in("id", completedDayIds)
          .order("sort_order", { ascending: true });
        setProgramDays((daysData ?? []) as ClientProgramDay[]);
      } else {
        setProgramDays([]);
      }

      setCheckIns(loadedCheckIns);
      setWorkouts(loadedWorkouts);
      setMessages((messageRes.data ?? []) as ClientMessage[]);
      setWeights((weightRes.data ?? []) as WeightLog[]);
      setPhotos((photoRes.data ?? []) as ProgressPhoto[]);

      if (loadedCheckIns.length === 0) {
        setCalorieSummaries({});
        setLoading(false);
        return;
      }

      const reviewWindows = loadedCheckIns.map((checkIn) => ({
        checkInWeekStart: checkIn.week_start,
        weekStart: addDays(checkIn.week_start, -7),
        weekEnd: addDays(checkIn.week_start, -1),
      }));
      const earliestLogDate = reviewWindows.reduce(
        (earliest, item) => (item.weekStart < earliest ? item.weekStart : earliest),
        reviewWindows[0].weekStart
      );
      const latestLogDate = reviewWindows.reduce(
        (latest, item) => (item.weekEnd > latest ? item.weekEnd : latest),
        reviewWindows[0].weekEnd
      );

      const [mealLogRes, customMealLogRes] = await Promise.all([
        supabase
          .from("meal_logs")
          .select("log_date, quantity, recipes(calories)")
          .eq("client_id", clientId)
          .eq("completed", true)
          .gte("log_date", earliestLogDate)
          .lte("log_date", latestLogDate),
        supabase
          .from("custom_meal_logs")
          .select("log_date, calories")
          .eq("client_id", clientId)
          .gte("log_date", earliestLogDate)
          .lte("log_date", latestLogDate),
      ]);

      const caloriesByDate: Record<string, number> = {};

      ((mealLogRes.data ?? []) as MealLogCalorieRow[]).forEach((meal) => {
        const recipeData = Array.isArray(meal.recipes)
          ? meal.recipes[0] ?? null
          : meal.recipes ?? null;
        const quantity = meal.quantity ?? 1;
        caloriesByDate[meal.log_date] =
          (caloriesByDate[meal.log_date] ?? 0) +
          (recipeData?.calories ?? 0) * quantity;
      });

      (customMealLogRes.data ?? []).forEach((meal) => {
        caloriesByDate[meal.log_date] =
          (caloriesByDate[meal.log_date] ?? 0) + (meal.calories ?? 0);
      });

      const summaries = reviewWindows.reduce<Record<string, CalorieWeekSummary>>(
        (result, item) => {
          let consumed = 0;
          for (let offset = 0; offset < 7; offset += 1) {
            consumed += caloriesByDate[addDays(item.weekStart, offset)] ?? 0;
          }

          const weeklyTarget = dailyCalorieTarget ? dailyCalorieTarget * 7 : null;
          const difference = weeklyTarget !== null ? consumed - weeklyTarget : null;

          result[item.checkInWeekStart] = {
            weekStart: item.weekStart,
            weekEnd: item.weekEnd,
            consumed,
            target: weeklyTarget,
            difference,
            averageDailyDifference:
              difference !== null ? Math.round(difference / 7) : null,
          };
          return result;
        },
        {}
      );

      setCalorieSummaries(summaries);
      setLoading(false);
    };

    loadInsights();
  }, [clientId]);

  const thisWeekWorkouts = workouts.filter(
    (workout) => workout.completed_date >= weekStart && workout.completed_date <= weekEnd
  );

  const thisWeekCheckIn = checkIns.find((checkIn) => checkIn.week_start === weekStart) ?? null;
  const latestCheckIn = checkIns[0] ?? null;
  const latestCalorieSummary = latestCheckIn
    ? calorieSummaries[latestCheckIn.week_start] ?? null
    : null;
  const unreadClientMessages = messages.filter(
    (message) => message.sender_role === "client" && !message.read_by_trainer_at
  );

  const latestWeight = weights[0] ?? null;
  const previousWeight = weights[1] ?? null;
  const weightDelta = latestWeight && previousWeight
    ? Number(latestWeight.weight_kg) - Number(previousWeight.weight_kg)
    : null;

  const plannedThisWeek = programDays.length;
  const adherenceWindowPlanned = plannedThisWeek > 0 ? plannedThisWeek * 4 : 0;
  const adherenceSince = addDays(today, -27);
  const adherenceCompleted = workouts.filter(
    (workout) => workout.completed_date >= adherenceSince && workout.completed_date <= today
  ).length;
  const adherencePct = adherenceWindowPlanned > 0
    ? Math.round((adherenceCompleted / adherenceWindowPlanned) * 100)
    : null;

  const summaryParts = [
    plannedThisWeek > 0
      ? `trained ${thisWeekWorkouts.length}/${plannedThisWeek}`
      : `${thisWeekWorkouts.length} workout${thisWeekWorkouts.length === 1 ? "" : "s"} logged`,
    thisWeekCheckIn
      ? `energy ${describeLevel(thisWeekCheckIn.energy_level, "low", "high")}`
      : "check-in missing",
    thisWeekCheckIn
      ? `hunger ${describeLevel(thisWeekCheckIn.hunger_level, "low", "high")}`
      : null,
    latestCalorieSummary?.difference !== null &&
    latestCalorieSummary?.difference !== undefined
      ? `previous week ${formatKcalDifference(latestCalorieSummary.difference).toLowerCase()}`
      : null,
    weightDelta !== null ? `weight ${formatDelta(weightDelta)}` : null,
    `${unreadClientMessages.length} unread message${unreadClientMessages.length === 1 ? "" : "s"}`,
  ].filter(Boolean);

  const checkInChartData = [...checkIns]
    .sort((a, b) => a.week_start.localeCompare(b.week_start))
    .map((checkIn) => ({
      week: formatDate(checkIn.week_start),
      energy: checkIn.energy_level,
      hunger: checkIn.hunger_level,
      motivation: checkIn.motivation_level,
      soreness: checkIn.soreness_level,
      sleep: checkIn.sleep_quality,
    }));

  const timeline = useMemo<TimelineItem[]>(() => {
    const workoutItems = workouts.map((workout) => ({
      key: `workout-${workout.id}`,
      date: workout.completed_at ?? `${workout.completed_date}T12:00:00`,
      title: "Workout completed",
      detail:
        programDays.find((day) => day.id === workout.client_program_day_id)?.day_name ||
        workout.completed_date,
      tone: "workout" as const,
    }));

    const checkInItems = checkIns.map((checkIn) => ({
      key: `checkin-${checkIn.id}`,
      date: checkIn.submitted_at ?? `${checkIn.week_start}T12:00:00`,
      title: "Weekly check-in",
      detail: `Energy ${checkIn.energy_level}/5, hunger ${checkIn.hunger_level}/5${
        checkIn.notes ? ` - ${checkIn.notes}` : ""
      }`,
      tone: "checkin" as const,
    }));

    const messageItems = messages.map((message) => ({
      key: `message-${message.id}`,
      date: message.created_at,
      title: message.sender_role === "client" ? "Client message" : "Trainer reply",
      detail: message.context_label ? `${message.context_label}: ${message.body}` : message.body,
      tone: "message" as const,
    }));

    const weightItems = weights.map((weight) => ({
      key: `weight-${weight.id}`,
      date: `${weight.log_date}T12:00:00`,
      title: "Weight logged",
      detail: `${weight.weight_kg}kg${weight.note ? ` - ${weight.note}` : ""}`,
      tone: "weight" as const,
    }));

    const photoItems = photos.map((photo) => ({
      key: `photo-${photo.id}`,
      date: `${photo.log_date}T12:00:00`,
      title: "Progress photo uploaded",
      detail: photo.note || photo.log_date,
      tone: "photo" as const,
    }));

    return [...workoutItems, ...checkInItems, ...messageItems, ...weightItems, ...photoItems]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 14);
  }, [checkIns, messages, photos, programDays, weights, workouts]);

  if (loading) {
    return <div className={styles.card}>Loading client insights...</div>;
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-ink">Client Intelligence</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Weekly coaching summary, check-in trends, adherence, and recent activity.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border-subtle bg-surface-raised p-4 shadow-subtle lg:col-span-2">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            Weekly coach summary
          </p>
          <p className="mt-2 text-lg font-semibold text-ink">
            {summaryParts.join(", ") || "No summary data yet"}.
          </p>
          {thisWeekCheckIn?.notes && (
            <p className="mt-3 text-sm text-ink-muted">
              &quot;{thisWeekCheckIn.notes}&quot;
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border-subtle bg-surface-raised p-4 shadow-subtle">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            Adherence
          </p>
          <p className="mt-2 text-2xl font-bold text-ink">
            {adherenceWindowPlanned > 0
              ? `${adherenceCompleted}/${adherenceWindowPlanned}`
              : `${adherenceCompleted}`}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Sessions completed in the last 4 weeks
          </p>
          {adherencePct !== null && (
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
              <div
                className="h-full rounded-full bg-gold"
                style={{ width: `${Math.min(adherencePct, 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-emerald/20 bg-surface-raised p-4 shadow-subtle">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h3 className="font-semibold text-ink">Calories Against Target</h3>
          {latestCalorieSummary && (
            <p className="text-xs text-ink-muted">
              Previous week: {formatDate(latestCalorieSummary.weekStart)} -{" "}
              {formatDate(latestCalorieSummary.weekEnd)}
            </p>
          )}
        </div>

        {!latestCalorieSummary ? (
          <p className="mt-3 text-sm text-ink-muted">
            No weekly check-in calorie window available yet.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg bg-surface-sunken p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                Consumed vs target
              </p>
              <p className="mt-1 text-lg font-bold text-ink">
                {formatKcal(latestCalorieSummary.consumed)}
              </p>
              <p className="text-sm text-ink-muted">
                /{" "}
                {latestCalorieSummary.target !== null
                  ? formatKcal(latestCalorieSummary.target)
                  : "No target set"}
              </p>
            </div>

            <div className="rounded-lg bg-surface-sunken p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                Total difference
              </p>
              <p className="mt-1 text-lg font-bold text-ink">
                {formatKcalDifference(latestCalorieSummary.difference)}
              </p>
            </div>

            <div className="rounded-lg bg-surface-sunken p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                Average daily difference
              </p>
              <p className="mt-1 text-lg font-bold text-ink">
                {formatKcalDifference(latestCalorieSummary.averageDailyDifference)}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-border-subtle bg-surface-raised p-4 shadow-subtle">
          <h3 className="font-semibold text-ink">Check-in History</h3>
          {checkInChartData.length < 2 ? (
            <p className="mt-3 text-sm text-ink-muted">
              Not enough weekly check-ins yet to show a trend.
            </p>
          ) : (
            <div className="mt-4 h-72 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={checkInChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="energy" stroke="#0f2a3d" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="hunger" stroke="#b88a2e" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="motivation" stroke="#18865b" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="soreness" stroke="#b45309" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="sleep" stroke="#4f46e5" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="mt-4 space-y-3">
            {checkIns.slice(0, 6).map((checkIn) => {
              const summary = calorieSummaries[checkIn.week_start] ?? null;

              return (
                <div
                  key={checkIn.id}
                  className="rounded-lg border border-border-subtle bg-surface-sunken px-3 py-2"
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        Check-in {formatDate(checkIn.week_start)}
                      </p>
                      <p className="text-xs text-ink-muted">
                        Energy {checkIn.energy_level}/5, hunger{" "}
                        {checkIn.hunger_level}/5, sleep {checkIn.sleep_quality}/5
                      </p>
                    </div>
                    {summary && (
                      <p className="text-xs text-ink-muted">
                        Calories: {formatKcal(summary.consumed)}
                        {summary.target !== null
                          ? ` / ${formatKcal(summary.target)}`
                          : ""}
                      </p>
                    )}
                  </div>
                  {summary && (
                    <p className="mt-2 text-sm text-ink">
                      Difference: {formatKcalDifference(summary.difference)} total,{" "}
                      {formatKcalDifference(summary.averageDailyDifference)} per day
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-border-subtle bg-surface-raised p-4 shadow-subtle">
          <h3 className="font-semibold text-ink">Client Timeline</h3>
          <div className="mt-4 space-y-3">
            {timeline.length === 0 ? (
              <p className="text-sm text-ink-muted">No recent activity yet.</p>
            ) : (
              timeline.map((item) => (
                <div
                  key={item.key}
                  className={`rounded-lg border px-3 py-2 ${toneClasses[item.tone]}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-ink">{item.title}</p>
                    <p className="shrink-0 text-xs text-ink-muted">
                      {new Date(item.date).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-ink-muted">
                    {item.detail}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
