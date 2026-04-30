"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type OverviewStats = {
  totalClients: number;
  totalWeightLost: number;
  totalSets: number;
  totalKgLifted: number;
};

type RecipeUsage = {
  name: string;
  count: number;
};

type CalorieAdherence = {
  name: string;
  value: number;
};

type WorkoutTrend = {
  date: string;
  sets: number;
};

type ClientLeaderboard = {
  client_name: string;
  metric_value: number;
};

type MuscleGroupVolume = {
  muscle: string;
  volume: number;
};

type RetentionData = {
  week: string;
  activePercent: number;
};

type MilestoneCompletion = {
  week: number;
  completed: number;
  total: number;
  percentage: number;
};

type MacroTrend = {
  date: string;
  protein: number;
  carbs: number;
  fat: number;
};

const COLORS = ["#1F6F5E", "#D4AF37", "#1C2A44", "#94A3B8"];

export default function TrainerAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [overviewStats, setOverviewStats] = useState<OverviewStats>({
    totalClients: 0,
    totalWeightLost: 0,
    totalSets: 0,
    totalKgLifted: 0,
  });

  const [recipeUsage, setRecipeUsage] = useState<RecipeUsage[]>([]);
  const [calorieAdherence, setCalorieAdherence] = useState<CalorieAdherence[]>([]);
  const [workoutTrends, setWorkoutTrends] = useState<WorkoutTrend[]>([]);
  const [setsLeaderboard, setSetsLeaderboard] = useState<ClientLeaderboard[]>([]);
  const [weightLiftedLeaderboard, setWeightLiftedLeaderboard] = useState<ClientLeaderboard[]>([]);
  const [weightLossLeaderboard, setWeightLossLeaderboard] = useState<ClientLeaderboard[]>([]);
  const [muscleGroupVolume, setMuscleGroupVolume] = useState<MuscleGroupVolume[]>([]);
  const [retentionData, setRetentionData] = useState<RetentionData[]>([]);
  const [milestoneCompletion, setMilestoneCompletion] = useState<MilestoneCompletion[]>([]);
  const [macroTrends, setMacroTrends] = useState<MacroTrend[]>([]);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);

    // Overview Stats
    await loadOverviewStats();

    // Nutrition Analytics
    await loadRecipeUsage();
    await loadCalorieAdherence();
    await loadMacroTrends();

    // Workout Analytics
    await loadWorkoutTrends();
    await loadMuscleGroupVolume();

    // Client Analytics
    await loadRetentionData();
    await loadMilestoneCompletion();

    // Leaderboards
    await loadSetsLeaderboard();
    await loadWeightLiftedLeaderboard();
    await loadWeightLossLeaderboard();

    setLoading(false);
  };

  const loadOverviewStats = async () => {
    // Total active clients
    const { count: clientCount } = await supabase
      .from("clients")
      .select("*", { count: "exact", head: true })
      .eq("onboarding_complete", true);

    // Total weight lost (first weight - latest weight for each client)
    const { data: clients } = await supabase
      .from("clients")
      .select("id")
      .eq("onboarding_complete", true);

    let totalWeightLost = 0;
    if (clients) {
      for (const client of clients) {
        const { data: weights } = await supabase
          .from("client_weight_logs")
          .select("weight_kg")
          .eq("client_id", client.id)
          .order("log_date", { ascending: true });

        if (weights && weights.length >= 2) {
          const firstWeight = weights[0].weight_kg;
          const latestWeight = weights[weights.length - 1].weight_kg;
          const loss = firstWeight - latestWeight;
          if (loss > 0) totalWeightLost += loss;
        }
      }
    }

    // Total sets completed
    const { data: setLogs } = await supabase
      .from("client_program_set_logs")
      .select("id")
      .eq("completed", true);

    const totalSets = setLogs?.length || 0;

    // Total kg lifted
    const { data: weightLogs } = await supabase
      .from("client_program_set_logs")
      .select("actual_weight_kg, actual_reps")
      .eq("completed", true)
      .not("actual_weight_kg", "is", null)
      .not("actual_reps", "is", null);

    const totalKgLifted = weightLogs?.reduce((sum, log) => {
      return sum + (log.actual_weight_kg * log.actual_reps);
    }, 0) || 0;

    setOverviewStats({
      totalClients: clientCount || 0,
      totalWeightLost: Math.round(totalWeightLost * 10) / 10,
      totalSets,
      totalKgLifted: Math.round(totalKgLifted),
    });
  };

  const loadRecipeUsage = async () => {
    const { data: mealLogs } = await supabase
      .from("meal_logs")
      .select("recipe_id, recipes(name)")
      .eq("completed", true);

    if (!mealLogs) return;

    const recipeCount: Record<string, number> = {};

    mealLogs.forEach((log: any) => {
      const recipeName = Array.isArray(log.recipes)
        ? log.recipes[0]?.name
        : log.recipes?.name;

      if (recipeName) {
        recipeCount[recipeName] = (recipeCount[recipeName] || 0) + 1;
      }
    });

    const sortedRecipes = Object.entries(recipeCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    setRecipeUsage(sortedRecipes);
  };

  const loadCalorieAdherence = async () => {
    const { data: clients } = await supabase
      .from("clients")
      .select("id, calorie_target")
      .eq("onboarding_complete", true)
      .not("calorie_target", "is", null);

    if (!clients) return;

    let onTarget = 0;
    let over = 0;
    let under = 0;

    for (const client of clients) {
      // Get last 7 days of meals
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

      const { data: meals } = await supabase
        .from("meal_logs")
        .select("log_date, quantity, recipes(calories)")
        .eq("client_id", client.id)
        .eq("completed", true)
        .gte("log_date", sevenDaysAgoStr);

      if (!meals) continue;

      // Group by date
      const dailyCalories: Record<string, number> = {};
      meals.forEach((meal: any) => {
        const calories = Array.isArray(meal.recipes)
          ? meal.recipes[0]?.calories
          : meal.recipes?.calories;
        const quantity = meal.quantity || 1;

        if (calories) {
          dailyCalories[meal.log_date] =
            (dailyCalories[meal.log_date] || 0) + calories * quantity;
        }
      });

      // Check adherence for each day
      Object.values(dailyCalories).forEach((dayCalories) => {
        const diff = Math.abs((client.calorie_target || 0) - dayCalories);
        if (diff <= 100) onTarget++;
        else if (dayCalories > (client.calorie_target || 0)) over++;
        else under++;
      });
    }

    setCalorieAdherence([
      { name: "On Target (±100)", value: onTarget },
      { name: "Over Target", value: over },
      { name: "Under Target", value: under },
    ]);
  };

  const loadMacroTrends = async () => {
    // Last 30 days of macro adherence
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

    const { data: clients } = await supabase
      .from("clients")
      .select("id, protein_g")
      .eq("onboarding_complete", true)
      .not("protein_g", "is", null);

    if (!clients) return;

    const dailyMacros: Record<string, { protein: number; carbs: number; fat: number; count: number }> = {};

    for (const client of clients) {
      const { data: meals } = await supabase
        .from("meal_logs")
        .select("log_date, quantity, recipes(protein_g, carbs_g, fat_g)")
        .eq("client_id", client.id)
        .eq("completed", true)
        .gte("log_date", thirtyDaysAgoStr);

      if (!meals) continue;

      meals.forEach((meal: any) => {
        const recipe = Array.isArray(meal.recipes) ? meal.recipes[0] : meal.recipes;
        const quantity = meal.quantity || 1;

        if (recipe) {
          if (!dailyMacros[meal.log_date]) {
            dailyMacros[meal.log_date] = { protein: 0, carbs: 0, fat: 0, count: 0 };
          }

          // Calculate % adherence to target
          const proteinTarget = client.protein_g || 150;
          const proteinActual = (recipe.protein_g || 0) * quantity;
          const proteinAdherence = proteinTarget > 0 ? (proteinActual / proteinTarget) * 100 : 0;

          dailyMacros[meal.log_date].protein += proteinAdherence;
          dailyMacros[meal.log_date].carbs += (recipe.carbs_g || 0) * quantity;
          dailyMacros[meal.log_date].fat += (recipe.fat_g || 0) * quantity;
          dailyMacros[meal.log_date].count += 1;
        }
      });
    }

    const trends = Object.entries(dailyMacros)
      .map(([date, macros]) => ({
        date,
        protein: Math.round((macros.protein / macros.count) || 0),
        carbs: Math.round(macros.carbs / macros.count),
        fat: Math.round(macros.fat / macros.count),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    setMacroTrends(trends);
  };

  const loadWorkoutTrends = async () => {
    // Last 30 days of workout activity
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

    const { data: setLogs } = await supabase
      .from("client_program_set_logs")
      .select("created_at")
      .eq("completed", true)
      .gte("created_at", thirtyDaysAgoStr);

    if (!setLogs) return;

    // Group by date
    const dailySets: Record<string, number> = {};
    setLogs.forEach((log) => {
      const date = log.created_at.split("T")[0];
      dailySets[date] = (dailySets[date] || 0) + 1;
    });

    const trends = Object.entries(dailySets)
      .map(([date, sets]) => ({ date, sets }))
      .sort((a, b) => a.date.localeCompare(b.date));

    setWorkoutTrends(trends);
  };

  const loadMuscleGroupVolume = async () => {
    // Get all completed sets with exercise details
    const { data: setLogs } = await supabase
      .from("client_program_set_logs")
      .select("client_program_day_exercise_id, actual_weight_kg, actual_reps")
      .eq("completed", true)
      .not("actual_weight_kg", "is", null)
      .not("actual_reps", "is", null);

    if (!setLogs) return;

    // Get exercise names for these sets
    const exerciseIds = [...new Set(setLogs.map((log) => log.client_program_day_exercise_id))];

    const { data: dayExercises } = await supabase
      .from("client_program_day_exercises")
      .select("id, exercise_name")
      .in("id", exerciseIds);

    if (!dayExercises) return;

    const exerciseNameMap = Object.fromEntries(
      dayExercises.map((ex) => [ex.id, ex.exercise_name])
    );

    // Get muscle groups for these exercises
    const exerciseNames = [...new Set(dayExercises.map((ex) => ex.exercise_name).filter(Boolean))];

    const { data: exercises } = await supabase
      .from("exercises")
      .select("name, target_muscle")
      .in("name", exerciseNames);

    if (!exercises) return;

    const muscleMap = Object.fromEntries(
      exercises.map((ex) => [ex.name, ex.target_muscle])
    );

    // Calculate volume per muscle group
    const muscleVolume: Record<string, number> = {};

    setLogs.forEach((log) => {
      const exerciseName = exerciseNameMap[log.client_program_day_exercise_id];
      const muscle = exerciseName ? muscleMap[exerciseName] : null;

      if (muscle) {
        const volume = log.actual_weight_kg * log.actual_reps;
        muscleVolume[muscle] = (muscleVolume[muscle] || 0) + volume;
      }
    });

    const sortedMuscles = Object.entries(muscleVolume)
      .map(([muscle, volume]) => ({ muscle, volume: Math.round(volume) }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 10);

    setMuscleGroupVolume(sortedMuscles);
  };

  const loadRetentionData = async () => {
    const { data: programs } = await supabase
      .from("client_programs")
      .select("client_id, program_start_date, current_week")
      .not("program_start_date", "is", null);

    if (!programs) return;

    const today = new Date();
    const weekBuckets = {
      "Week 1": 0,
      "Week 4": 0,
      "Week 8": 0,
      "Week 12": 0,
      "Week 16+": 0,
    };

    const totalStarted = programs.length;

    programs.forEach((program) => {
      const startDate = new Date(program.program_start_date);
      const daysSinceStart = Math.floor(
        (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const weeksSinceStart = Math.floor(daysSinceStart / 7) + 1;

      // Check if still active (logged activity in last 14 days)
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      // Count as active if in their current week range
      if (weeksSinceStart >= 1) weekBuckets["Week 1"]++;
      if (weeksSinceStart >= 4) weekBuckets["Week 4"]++;
      if (weeksSinceStart >= 8) weekBuckets["Week 8"]++;
      if (weeksSinceStart >= 12) weekBuckets["Week 12"]++;
      if (weeksSinceStart >= 16) weekBuckets["Week 16+"]++;
    });

    const retention = Object.entries(weekBuckets).map(([week, count]) => ({
      week,
      activePercent: totalStarted > 0 ? Math.round((count / totalStarted) * 100) : 0,
    }));

    setRetentionData(retention);
  };

  const loadMilestoneCompletion = async () => {
    const milestoneWeeks = [4, 8, 12];
    const completion: MilestoneCompletion[] = [];

    for (const week of milestoneWeeks) {
      // Get all clients who have reached this week
      const { data: programs } = await supabase
        .from("client_programs")
        .select("client_id, current_week")
        .gte("current_week", week);

      const totalEligible = programs?.length || 0;

      // Get clients who completed this milestone
      const { data: completedMilestones } = await supabase
        .from("client_milestones")
        .select("id")
        .eq("program_week", week)
        .eq("questionnaire_completed", true)
        .eq("photos_completed", true);

      const completed = completedMilestones?.length || 0;

      completion.push({
        week,
        completed,
        total: totalEligible,
        percentage: totalEligible > 0 ? Math.round((completed / totalEligible) * 100) : 0,
      });
    }

    setMilestoneCompletion(completion);
  };

  const loadSetsLeaderboard = async () => {
    const { data: clients } = await supabase
      .from("clients")
      .select("id, full_name")
      .eq("onboarding_complete", true);

    if (!clients) return;

    const leaderboard: ClientLeaderboard[] = [];

    for (const client of clients) {
      const { count } = await supabase
        .from("client_program_set_logs")
        .select("*", { count: "exact", head: true })
        .eq("client_id", client.id)
        .eq("completed", true);

      leaderboard.push({
        client_name: client.full_name,
        metric_value: count || 0,
      });
    }

    leaderboard.sort((a, b) => b.metric_value - a.metric_value);
    setSetsLeaderboard(leaderboard.slice(0, 10));
  };

  const loadWeightLiftedLeaderboard = async () => {
    const { data: clients } = await supabase
      .from("clients")
      .select("id, full_name")
      .eq("onboarding_complete", true);

    if (!clients) return;

    const leaderboard: ClientLeaderboard[] = [];

    for (const client of clients) {
      const { data: logs } = await supabase
        .from("client_program_set_logs")
        .select("actual_weight_kg, actual_reps")
        .eq("client_id", client.id)
        .eq("completed", true)
        .not("actual_weight_kg", "is", null)
        .not("actual_reps", "is", null);

      const totalKg = logs?.reduce((sum, log) => {
        return sum + (log.actual_weight_kg * log.actual_reps);
      }, 0) || 0;

      leaderboard.push({
        client_name: client.full_name,
        metric_value: Math.round(totalKg),
      });
    }

    leaderboard.sort((a, b) => b.metric_value - a.metric_value);
    setWeightLiftedLeaderboard(leaderboard.slice(0, 10));
  };

  const loadWeightLossLeaderboard = async () => {
    const { data: clients } = await supabase
      .from("clients")
      .select("id, full_name")
      .eq("onboarding_complete", true);

    if (!clients) return;

    const leaderboard: ClientLeaderboard[] = [];

    for (const client of clients) {
      const { data: weights } = await supabase
        .from("client_weight_logs")
        .select("weight_kg")
        .eq("client_id", client.id)
        .order("log_date", { ascending: true });

      if (weights && weights.length >= 2) {
        const firstWeight = weights[0].weight_kg;
        const latestWeight = weights[weights.length - 1].weight_kg;
        const loss = firstWeight - latestWeight;

        if (loss > 0) {
          leaderboard.push({
            client_name: client.full_name,
            metric_value: Math.round(loss * 10) / 10,
          });
        }
      }
    }

    leaderboard.sort((a, b) => b.metric_value - a.metric_value);
    setWeightLossLeaderboard(leaderboard.slice(0, 10));
  };

  return (
    <>
      <h1 className={styles.display}>Analytics</h1>

      {loading ? (
        <p className={styles.body}>Loading analytics...</p>
      ) : (
        <div className="mt-6 space-y-8">
          {/* Overview Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <div className={styles.card}>
              <p className="text-sm font-medium text-ink-muted">Total Clients</p>
              <p className="mt-2 text-3xl font-bold text-ink">
                {overviewStats.totalClients}
              </p>
            </div>

            <div className={styles.card}>
              <p className="text-sm font-medium text-ink-muted">
                Total Weight Lost
              </p>
              <p className="mt-2 text-3xl font-bold text-gold">
                {overviewStats.totalWeightLost} kg
              </p>
            </div>

            <div className={styles.card}>
              <p className="text-sm font-medium text-ink-muted">
                Total Sets Completed
              </p>
              <p className="mt-2 text-3xl font-bold text-navy">
                {overviewStats.totalSets.toLocaleString()}
              </p>
            </div>

            <div className={styles.card}>
              <p className="text-sm font-medium text-ink-muted">
                Total KG Lifted
              </p>
              <p className="mt-2 text-3xl font-bold text-emerald">
                {overviewStats.totalKgLifted.toLocaleString()} kg
              </p>
            </div>
          </div>

          {/* Nutrition Analytics */}
          <section>
            <h2 className="mb-4 text-2xl font-bold text-emerald">
              Nutrition Analytics
            </h2>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Recipe Usage */}
              <div className={styles.card}>
                <h3 className="text-lg font-semibold text-ink">Top 10 Most Popular Recipes</h3>
                <div className="mt-4 h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={recipeUsage}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        interval={0}
                      />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#1F6F5E" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Calorie Adherence */}
              <div className={styles.card}>
                <h3 className="text-lg font-semibold text-ink">Calorie Target Adherence</h3>
                <p className="mt-1 text-sm text-ink-muted">
                  Last 7 days across all clients
                </p>
                <div className="mt-4 h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={calorieAdherence}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(props: any) => {
  const { name, percent } = props;
  return `${name}: ${(percent * 100).toFixed(0)}%`;
}}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {calorieAdherence.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Macro Adherence Trends */}
            <div className={`${styles.card} mt-6`}>
              <h3 className="text-lg font-semibold text-ink">Macro Adherence Trends</h3>
              <p className="mt-1 text-sm text-ink-muted">
                Average daily macros (last 30 days)
              </p>
              <div className="mt-4 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={macroTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="protein"
                      stroke="#1F6F5E"
                      strokeWidth={2}
                      name="Protein %"
                    />
                    <Line
                      type="monotone"
                      dataKey="carbs"
                      stroke="#D4AF37"
                      strokeWidth={2}
                      name="Carbs (g)"
                    />
                    <Line
                      type="monotone"
                      dataKey="fat"
                      stroke="#1C2A44"
                      strokeWidth={2}
                      name="Fat (g)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* Workout Analytics */}
          <section>
            <h2 className="mb-4 text-2xl font-bold text-navy">
              Workout Analytics
            </h2>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Sets Over Time */}
              <div className={styles.card}>
                <h3 className="text-lg font-semibold text-ink">Sets Completed Over Time</h3>
                <p className="mt-1 text-sm text-ink-muted">Last 30 days</p>
                <div className="mt-4 h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={workoutTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="sets"
                        stroke="#1C2A44"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Volume by Muscle Group */}
              <div className={styles.card}>
                <h3 className="text-lg font-semibold text-ink">Volume by Muscle Group</h3>
                <p className="mt-1 text-sm text-ink-muted">
                  Total weight × reps (all time)
                </p>
                <div className="mt-4 h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={muscleGroupVolume}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="muscle" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="volume" fill="#1C2A44" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </section>

          {/* Client Analytics */}
          <section>
            <h2 className="mb-4 text-2xl font-bold text-gold">
              Client Engagement
            </h2>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Retention Curve */}
              <div className={styles.card}>
                <h3 className="text-lg font-semibold text-ink">Client Retention Curve</h3>
                <p className="mt-1 text-sm text-ink-muted">
                  % of clients still active at each milestone
                </p>
                <div className="mt-4 h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={retentionData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="activePercent"
                        stroke="#D4AF37"
                        strokeWidth={3}
                        name="Active %"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Milestone Completion */}
              <div className={styles.card}>
                <h3 className="text-lg font-semibold text-ink">Milestone Completion Rates</h3>
                <p className="mt-1 text-sm text-ink-muted">
                  Questionnaire + Photos submitted
                </p>
                <div className="mt-4 space-y-4">
                  {milestoneCompletion.map((milestone) => (
                    <div key={milestone.week}>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium text-ink">
                          Week {milestone.week}
                        </span>
                        <span className="text-sm text-ink-muted">
                          {milestone.completed} / {milestone.total} (
                          {milestone.percentage}%)
                        </span>
                      </div>
                      <div className="h-3 w-full rounded-full bg-surface-sunken">
                        <div
                          className="h-3 rounded-full bg-gold transition-all"
                          style={{ width: `${milestone.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Leaderboards */}
          <section>
            <h2 className="mb-4 text-2xl font-bold text-gold">
              Client Leaderboards
            </h2>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Most Sets */}
              <div className={styles.card}>
                <h3 className="text-lg font-semibold text-ink">Most Sets Completed</h3>
                <div className="mt-4 space-y-2">
                  {setsLeaderboard.length === 0 ? (
                    <p className="text-sm text-ink-muted">No data yet</p>
                  ) : (
                    setsLeaderboard.map((client, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-lg bg-surface-sunken px-3 py-2"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                            {index + 1}
                          </span>
                          <span className="text-sm font-medium text-ink">
                            {client.client_name}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-navy">
                          {client.metric_value}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Most Weight Lifted */}
              <div className={styles.card}>
                <h3 className="text-lg font-semibold text-ink">Most Weight Lifted</h3>
                <div className="mt-4 space-y-2">
                  {weightLiftedLeaderboard.length === 0 ? (
                    <p className="text-sm text-ink-muted">No data yet</p>
                  ) : (
                    weightLiftedLeaderboard.map((client, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-lg bg-surface-sunken px-3 py-2"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald text-xs font-bold text-white">
                            {index + 1}
                          </span>
                          <span className="text-sm font-medium text-ink">
                            {client.client_name}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-emerald">
                          {client.metric_value.toLocaleString()} kg
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Biggest Weight Loss */}
              <div className={styles.card}>
                <h3 className="text-lg font-semibold text-ink">Biggest Weight Loss</h3>
                <div className="mt-4 space-y-2">
                  {weightLossLeaderboard.length === 0 ? (
                    <p className="text-sm text-ink-muted">No data yet</p>
                  ) : (
                    weightLossLeaderboard.map((client, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-lg bg-surface-sunken px-3 py-2"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold text-xs font-bold text-white">
                            {index + 1}
                          </span>
                          <span className="text-sm font-medium text-ink">
                            {client.client_name}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-gold">
                          {client.metric_value} kg
                        </span>
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