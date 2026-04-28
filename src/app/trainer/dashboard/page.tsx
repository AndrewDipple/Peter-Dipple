"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { styles } from "@/lib/design";
import { supabase } from "@/lib/supabase";

type Client = {
  id: string;
  full_name: string;
  email: string;
  calorie_target: number | null;
  daily_step_target: number;
};

type WorkoutSetLog = {
  id: string;
  client_id: string;
  client_program_day_id: string;
  client_program_day_exercise_id: string;
  completed: boolean;
  created_at: string;
};

type ProgramExercise = {
  id: string;
  client_program_day_id: string;
  sets: number | null;
};

type MealLogRow = {
  client_id: string;
  quantity: number | null;
  recipes: {
    calories: number | null;
  } | {
    calories: number | null;
  }[] | null;
};

type DailyTracking = {
  id: string;
  client_id: string;
  water_completed: boolean;
  steps_logged: number | null;
};

type ClientStatusCard = {
  client: Client;
  workout: {
    status: "green" | "amber" | "red";
    label: string;
  };
  nutrition: {
    status: "green" | "amber" | "red";
    label: string;
  };
  steps: number | null;
  waterCompleted: boolean;
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
  if (status === "green") return styles.statusGreen;
  if (status === "amber") return styles.statusAmber;
  return styles.statusRed;
}

export default function TrainerDashboardPage() {
  const [selectedDate, setSelectedDate] = useState(getDateString(new Date()));
  const [clientCards, setClientCards] = useState<ClientStatusCard[]>([]);
  const [loading, setLoading] = useState(true);

  const readableDate = useMemo(() => {
    return new Date(`${selectedDate}T12:00:00`).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, [selectedDate]);

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);

      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select("id, full_name, email, calorie_target, daily_step_target")
        .order("full_name", { ascending: true });

      if (clientsError || !clientsData) {
        setClientCards([]);
        setLoading(false);
        return;
      }

      const clients = clientsData as Client[];
      const clientIds = clients.map((client) => client.id);

      let setLogs: WorkoutSetLog[] = [];
      let mealLogs: MealLogRow[] = [];
      let dailyTrackingData: DailyTracking[] = [];

      if (clientIds.length > 0) {
        const dayStart = `${selectedDate}T00:00:00`;
        const dayEnd = `${selectedDate}T23:59:59`;

        const { data: setLogData } = await supabase
          .from("client_program_set_logs")
          .select(
            "id, client_id, client_program_day_id, client_program_day_exercise_id, completed, created_at"
          )
          .in("client_id", clientIds)
          .gte("created_at", dayStart)
          .lte("created_at", dayEnd);

        if (setLogData) {
          setLogs = setLogData as WorkoutSetLog[];
        }

        const { data: mealLogData } = await supabase
          .from("meal_logs")
          .select("client_id, quantity, recipes(calories)")
          .in("client_id", clientIds)
          .eq("log_date", selectedDate)
          .eq("completed", true);

        if (mealLogData) {
          mealLogs = mealLogData as MealLogRow[];
        }

        // Load daily tracking
        const { data: trackingData } = await supabase
          .from("daily_tracking")
          .select("*")
          .in("client_id", clientIds)
          .eq("log_date", selectedDate);

        if (trackingData) {
          dailyTrackingData = trackingData as DailyTracking[];
        }
      }

      const exerciseIds = Array.from(
        new Set(setLogs.map((log) => log.client_program_day_exercise_id))
      );

      let programExercises: ProgramExercise[] = [];
      if (exerciseIds.length > 0) {
        const { data: exerciseData } = await supabase
          .from("client_program_day_exercises")
          .select("id, client_program_day_id, sets")
          .in("id", exerciseIds);

        if (exerciseData) {
          programExercises = exerciseData as ProgramExercise[];
        }
      }

      const exerciseMap = new Map(programExercises.map((e) => [e.id, e]));
      const trackingMap = new Map(dailyTrackingData.map((t) => [t.client_id, t]));

      const cards: ClientStatusCard[] = clients.map((client) => {
        const clientWorkoutLogs = setLogs.filter((log) => log.client_id === client.id);
        const clientTracking = trackingMap.get(client.id);

        let workoutStatus: ClientStatusCard["workout"];

        if (clientWorkoutLogs.length === 0) {
          workoutStatus = {
            status: "red",
            label: "No workout logged",
          };
        } else {
          const completedSetCounts = new Map<string, number>();
          const exerciseTargets = new Map<string, number>();

          for (const log of clientWorkoutLogs) {
            const currentCompleted = completedSetCounts.get(log.client_program_day_exercise_id) ?? 0;
            if (log.completed) {
              completedSetCounts.set(log.client_program_day_exercise_id, currentCompleted + 1);
            } else if (!completedSetCounts.has(log.client_program_day_exercise_id)) {
              completedSetCounts.set(log.client_program_day_exercise_id, 0);
            }

            const exercise = exerciseMap.get(log.client_program_day_exercise_id);
            if (exercise) {
              exerciseTargets.set(
                log.client_program_day_exercise_id,
                exercise.sets ?? 0
              );
            }
          }

          const exerciseIdsForClient = Array.from(exerciseTargets.keys());

          const fullyCompletedExercises = exerciseIdsForClient.filter((exerciseId) => {
            const targetSets = exerciseTargets.get(exerciseId) ?? 0;
            const completedSets = completedSetCounts.get(exerciseId) ?? 0;
            return targetSets > 0 && completedSets >= targetSets;
          }).length;

          const totalTrackedExercises = exerciseIdsForClient.length;

          if (totalTrackedExercises > 0 && fullyCompletedExercises === totalTrackedExercises) {
            workoutStatus = {
              status: "green",
              label: `${fullyCompletedExercises}/${totalTrackedExercises} exercises complete`,
            };
          } else {
            workoutStatus = {
              status: "amber",
              label: `${fullyCompletedExercises}/${totalTrackedExercises || 0} exercises complete`,
            };
          }
        }

        const clientMealLogs = mealLogs.filter((log) => log.client_id === client.id);

        let totalCalories = 0;
        for (const meal of clientMealLogs) {
          const recipeCalories = Array.isArray(meal.recipes)
            ? meal.recipes[0]?.calories
            : meal.recipes?.calories;

          totalCalories += (recipeCalories ?? 0) * (meal.quantity ?? 1);
        }

        let nutritionStatus: ClientStatusCard["nutrition"];

        if (client.calorie_target === null || client.calorie_target === undefined) {
          nutritionStatus = {
            status: "red",
            label: `${totalCalories} kcal logged`,
          };
        } else {
          const diff = Math.abs(client.calorie_target - totalCalories);

          if (diff <= 100) {
            nutritionStatus = {
              status: "green",
              label: `${totalCalories}/${client.calorie_target} kcal`,
            };
          } else if (diff <= 300) {
            nutritionStatus = {
              status: "amber",
              label: `${totalCalories}/${client.calorie_target} kcal`,
            };
          } else {
            nutritionStatus = {
              status: "red",
              label: `${totalCalories}/${client.calorie_target} kcal`,
            };
          }
        }

        return {
          client,
          workout: workoutStatus,
          nutrition: nutritionStatus,
          steps: clientTracking?.steps_logged ?? null,
          waterCompleted: clientTracking?.water_completed ?? false,
        };
      });

      setClientCards(cards);
      setLoading(false);
    };

    loadDashboard();
  }, [selectedDate]);

  return (
    <>
      <h1 className={styles.display}>Trainer Dashboard</h1>

      <div className={`${styles.card} mt-6 mb-6`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-ink-muted">Viewing status for</p>
            <p className="text-lg font-semibold text-ink">{readableDate}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className={styles.input}
            />
            <button
              type="button"
              onClick={() => setSelectedDate((prev) => shiftDate(prev, -1))}
              className={styles.buttonSecondary}
            >
              Previous Day
            </button>
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
      </div>

      {loading ? (
        <p className={styles.body}>Loading dashboard...</p>
      ) : clientCards.length === 0 ? (
        <p className={styles.body}>No clients found.</p>
      ) : (
        <div className="space-y-4">
          {clientCards.map((card) => (
            <Link
              key={card.client.id}
              href={`/trainer/clients/${card.client.id}`}
              className="block"
            >
              <div className={`${styles.card} hover:bg-surface-sunken transition`}>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-ink">
                      {card.client.full_name}
                    </h2>
                    <p className="mt-1 text-sm text-ink-muted">
                      {card.client.email}
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {/* Workout Card */}
                    <div
                      className={`rounded-xl px-4 py-3 ${getStatusClasses(
                        card.workout.status
                      )}`}
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                        Workout
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {card.workout.label}
                      </p>
                      <p className="mt-1 text-xs opacity-70">
                        Steps: {card.steps?.toLocaleString() ?? "0"} / {card.client.daily_step_target.toLocaleString()}
                      </p>
                    </div>

                    {/* Nutrition Card */}
                    <div
                      className={`rounded-xl px-4 py-3 ${getStatusClasses(
                        card.nutrition.status
                      )}`}
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                        Nutrition
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {card.nutrition.label}
                      </p>
                      <p className="mt-1 text-xs opacity-70">
                        Water: {card.waterCompleted ? "Complete ✓" : "Not logged"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}