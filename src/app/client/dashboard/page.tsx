"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/PageHeader";
import { styles } from "@/lib/design";

type Client = {
  id: string;
  full_name: string;
  calorie_target: number | null;
  protein_g: number | null;
  profile_id: string | null;
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
  sets: number | null;
};

type ClientProgramSetLog = {
  id: string;
  client_program_day_exercise_id: string;
  completed: boolean;
};

type WeightLog = {
  id: string;
  weight_kg: number;
  log_date: string;
  note: string | null;
};

export default function ClientDashboardPage() {
  const [client, setClient] = useState<Client | null>(null);
  const [currentDay, setCurrentDay] = useState<ClientProgramDay | null>(null);
  const [dayExercises, setDayExercises] = useState<ClientProgramDayExercise[]>([]);
  const [setLogs, setSetLogs] = useState<ClientProgramSetLog[]>([]);
  const [todayCalories, setTodayCalories] = useState(0);
  const [latestWeight, setLatestWeight] = useState<WeightLog | null>(null);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split("T")[0];

  const completedExercises = useMemo(() => {
    return dayExercises.filter((exercise) => {
      const targetSets = exercise.sets ?? 0;
      if (targetSets === 0) return false;

      const completedSets = setLogs.filter(
        (log) =>
          log.client_program_day_exercise_id === exercise.id && log.completed
      ).length;

      return completedSets >= targetSets;
    }).length;
  }, [dayExercises, setLogs]);

  const totalExercises = dayExercises.length;

  const caloriesRemaining =
    client?.calorie_target !== null && client?.calorie_target !== undefined
      ? client.calorie_target - todayCalories
      : null;

  const loadDashboard = async () => {
    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setClient(null);
      setLoading(false);
      return;
    }

    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .select("*")
      .eq("profile_id", user.id)
      .single();

    if (clientError || !clientData) {
      setClient(null);
      setLoading(false);
      return;
    }

    setClient(clientData);

    const { data: weightData } = await supabase
      .from("client_weight_logs")
      .select("*")
      .eq("client_id", clientData.id)
      .order("log_date", { ascending: false })
      .limit(1);

    if (weightData && weightData.length > 0) {
      setLatestWeight(weightData[0]);
    } else {
      setLatestWeight(null);
    }

    const { data: clientProgramData, error: clientProgramError } = await supabase
      .from("client_programs")
      .select("*")
      .eq("client_id", clientData.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!clientProgramError && clientProgramData && clientProgramData.length > 0) {
      const program = clientProgramData[0];

      const { data: daysData, error: daysError } = await supabase
        .from("client_program_days")
        .select("*")
        .eq("client_program_id", program.id)
        .order("sort_order", { ascending: true });

      if (!daysError && daysData && daysData.length > 0) {
        const firstIncompleteDay =
          daysData.find((day) => !day.completed) ?? daysData[0];

        setCurrentDay(firstIncompleteDay);

        const { data: exerciseData, error: exerciseError } = await supabase
          .from("client_program_day_exercises")
          .select("id, client_program_day_id, sets")
          .eq("client_program_day_id", firstIncompleteDay.id)
          .order("sort_order", { ascending: true });

        if (!exerciseError && exerciseData) {
          setDayExercises(exerciseData);

          const exerciseIds = exerciseData.map((e) => e.id);

          if (exerciseIds.length > 0) {
            const { data: setLogData, error: setLogError } = await supabase
              .from("client_program_set_logs")
              .select("id, client_program_day_exercise_id, completed")
              .eq("client_id", clientData.id)
              .eq("client_program_day_id", firstIncompleteDay.id)
              .in("client_program_day_exercise_id", exerciseIds);

            if (!setLogError && setLogData) {
              setSetLogs(setLogData);
            } else {
              setSetLogs([]);
            }
          } else {
            setSetLogs([]);
          }
        } else {
          setDayExercises([]);
          setSetLogs([]);
        }
      } else {
        setCurrentDay(null);
        setDayExercises([]);
        setSetLogs([]);
      }
    } else {
      setCurrentDay(null);
      setDayExercises([]);
      setSetLogs([]);
    }

    let recipeCaloriesTotal = 0;
    let customCaloriesTotal = 0;

    const { data: mealData } = await supabase
      .from("meal_logs")
      .select("quantity, recipes(calories)")
      .eq("client_id", clientData.id)
      .eq("log_date", today)
      .eq("completed", true);

    if (mealData) {
      recipeCaloriesTotal = mealData.reduce((sum: number, item: any) => {
        const recipeCalories = Array.isArray(item.recipes)
          ? item.recipes[0]?.calories
          : item.recipes?.calories;

        const quantity = item.quantity ?? 1;

        return sum + (recipeCalories ?? 0) * quantity;
      }, 0);
    }

    const { data: customMealData } = await supabase
      .from("custom_meal_logs")
      .select("calories")
      .eq("client_id", clientData.id)
      .eq("log_date", today);

    if (customMealData) {
      customCaloriesTotal = customMealData.reduce(
        (sum, meal) => sum + (meal.calories ?? 0),
        0
      );
    }

    setTodayCalories(recipeCaloriesTotal + customCaloriesTotal);
    setLoading(false);
  };

  useEffect(() => {
    loadDashboard();
  }, [today]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <PageHeader
          title="Dashboard"
          rightAction={
            <button onClick={handleLogout} className={styles.buttonPrimary}>
              Logout
            </button>
          }
        />

        {loading ? (
          <p className={styles.body}>Loading dashboard...</p>
        ) : !client ? (
          <p className={styles.body}>Client not found.</p>
        ) : (
          <div className="space-y-4">
            <div className={styles.card}>
              <h2 className={`text-2xl font-semibold ${styles.goldText}`}>
                Welcome, {client.full_name}
              </h2>
              <p className={`mt-2 ${styles.body}`}>
                Here’s your progress for today.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Link
                href="/client/workout"
                className={`${styles.card} bg-[#F2F2F2] transition hover:bg-[#eaeaea]`}
              >
                <p className="text-sm text-[#2B2B2B]">Today’s Workout</p>
                <p className="mt-1 text-lg font-semibold text-[#111111]">
                  {currentDay?.day_name || "No active programme day"}
                </p>
                <p className="mt-2 text-sm text-[#2B2B2B]">
                  {completedExercises} of {totalExercises} exercises complete
                </p>
              </Link>

              <Link
                href="/client/nutrition"
                className={`${styles.card} bg-[#F2F2F2] transition hover:bg-[#eaeaea]`}
              >
                <p className="text-sm text-[#2B2B2B]">Food Eaten Today</p>
                <p className="mt-1 text-lg font-semibold text-[#111111]">
                  {todayCalories} kcal
                </p>
                <p className="mt-2 text-sm text-[#2B2B2B]">
                  Remaining: {caloriesRemaining ?? "-"} kcal
                </p>
              </Link>
            </div>

            <Link
              href="/client/stats"
              className={`${styles.card} bg-[#F2F2F2] transition hover:bg-[#eaeaea] block`}
            >
              <p className="text-sm text-[#2B2B2B]">My Stats</p>
              <p className="mt-1 text-lg font-semibold text-[#111111]">
                {latestWeight
                  ? `Latest weight: ${latestWeight.weight_kg} kg`
                  : "Track weight, measurements, and progress photos"}
              </p>
              <div className="mt-3 h-20 rounded-xl bg-white/70 p-3">
                <div className="flex h-full items-end gap-2">
                  <div className="w-1/6 rounded-t bg-[#D4AF37]" style={{ height: "35%" }} />
                  <div className="w-1/6 rounded-t bg-[#D4AF37]" style={{ height: "55%" }} />
                  <div className="w-1/6 rounded-t bg-[#D4AF37]" style={{ height: "48%" }} />
                  <div className="w-1/6 rounded-t bg-[#D4AF37]" style={{ height: "70%" }} />
                  <div className="w-1/6 rounded-t bg-[#D4AF37]" style={{ height: "62%" }} />
                  <div className="w-1/6 rounded-t bg-[#D4AF37]" style={{ height: "82%" }} />
                </div>
              </div>
              <p className="mt-2 text-sm text-[#2B2B2B]">
                View graphs, measurements, and photos
              </p>
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}