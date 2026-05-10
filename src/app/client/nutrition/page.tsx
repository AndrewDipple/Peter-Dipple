"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";
import { updateStreak } from "@/lib/streaks";
import { awardBondXp } from "@/lib/companions";
import MessageTrainerBox from "@/components/MessageTrainerBox";
import ClientUnreadRepliesBanner from "@/components/ClientUnreadRepliesBanner";
import GuideLink from "@/components/GuideLink";
import {
  todayStr,
  addDays,
  formatLongDate,
} from "@/lib/dates";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

type Recipe = {
  id: string;
  name: string;
  description: string | null;
  calories: number | null;
  image_url: string | null;
};

type MealLog = {
  id: string;
  recipe_id: string;
  client_id: string;
  log_date: string;
  completed: boolean;
  quantity: number | null;
  recipes: {
    name: string;
    calories: number | null;
  } | null;
};

type CustomMeal = {
  id: string;
  meal_name: string;
  calories: number;
  log_date: string;
  note: string | null;
};

type PlannedMeal = {
  id: string;
  recipe_id: string;
  quantity: number;
  recipes: {
    name: string;
    calories: number | null;
  } | null;
};

export default function ClientNutritionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [clientId, setClientId] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [mealLogs, setMealLogs] = useState<MealLog[]>([]);
  const [customMeals, setCustomMeals] = useState<CustomMeal[]>([]);
  const [plannedMeals, setPlannedMeals] = useState<PlannedMeal[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [addingRecipe, setAddingRecipe] = useState(false);
  const [removingMealId, setRemovingMealId] = useState<string | null>(null);
  const [loggingPlannedId, setLoggingPlannedId] = useState<string | null>(null);

  const [customMealName, setCustomMealName] = useState("");
  const [customMealCalories, setCustomMealCalories] = useState("");
  const [customMealNote, setCustomMealNote] = useState("");
  const [savingCustomMeal, setSavingCustomMeal] = useState(false);
  const [removingCustomMealId, setRemovingCustomMealId] = useState<string | null>(null);

  // Resolve selected date from URL or default to today.
  const selectedDate = useMemo(() => {
    const param = searchParams.get("date");
    if (param) return param;
    return todayStr();
  }, [searchParams]);

  const isToday = selectedDate === todayStr();
  const isFuture = selectedDate > todayStr();

  const recipeCaloriesTotal = useMemo(() => {
    return mealLogs.reduce((sum, item) => {
      const calories = item.recipes?.calories ?? 0;
      const quantity = item.quantity ?? 1;
      return sum + calories * quantity;
    }, 0);
  }, [mealLogs]);

  const customCaloriesTotal = useMemo(() => {
    return customMeals.reduce((sum, meal) => sum + (meal.calories ?? 0), 0);
  }, [customMeals]);

  const totalCalories = recipeCaloriesTotal + customCaloriesTotal;

type EatenMeal = {
  key: string;
  source: "recipe" | "custom";
  name: string;
  calories: number;
  note: string | null;
  removeId: string;
  createdAt: string;
};

const eatenMeals = useMemo<EatenMeal[]>(() => {
  const recipeRows: EatenMeal[] = mealLogs.map((meal) => {
    const quantity = meal.quantity ?? 1;
    const caloriesPerMeal = meal.recipes?.calories ?? 0;
    return {
      key: `recipe-${meal.id}`,
      source: "recipe",
      name: meal.recipes?.name || "Unnamed meal",
      calories: caloriesPerMeal * quantity,
      note: null,
      removeId: meal.id,
      createdAt: meal.log_date, // we don't have timestamp on these in state
    };
  });

  const customRows: EatenMeal[] = customMeals.map((meal) => ({
    key: `custom-${meal.id}`,
    source: "custom",
    name: meal.meal_name,
    calories: meal.calories ?? 0,
    note: meal.note,
    removeId: meal.id,
    createdAt: meal.log_date,
  }));

  // Recipe and custom queries both order newest-first; merging preserves
  // approximate order. For perfect ordering we'd need a created_at field —
  // good enough for v1.
  return [...recipeRows, ...customRows];
}, [mealLogs, customMeals]);

  // Compute the unfulfilled-chips list. For each planned recipe, show
  // (planned count − logged count) chips. If logged ≥ planned, hide.
  const unfulfilledChips = useMemo(() => {
    // Tally planned by recipe (account for any legacy quantity > 1).
    const plannedByRecipe = new Map<string, { count: number; sample: PlannedMeal }>();
    for (const p of plannedMeals) {
      const existing = plannedByRecipe.get(p.recipe_id);
      const qty = p.quantity ?? 1;
      if (existing) existing.count += qty;
      else plannedByRecipe.set(p.recipe_id, { count: qty, sample: p });
    }

    // Tally logs by recipe.
    const loggedByRecipe = new Map<string, number>();
    for (const m of mealLogs) {
      const qty = m.quantity ?? 1;
      loggedByRecipe.set(m.recipe_id, (loggedByRecipe.get(m.recipe_id) ?? 0) + qty);
    }

    // Build chip list — one chip per outstanding planned meal.
    const chips: PlannedMeal[] = [];
    for (const [recipeId, { count, sample }] of plannedByRecipe.entries()) {
      const logged = loggedByRecipe.get(recipeId) ?? 0;
      const remaining = count - logged;
      for (let i = 0; i < remaining; i++) chips.push(sample);
    }
    return chips;
  }, [plannedMeals, mealLogs]);

  const loadPage = useCallback(async () => {
    setLoading(true);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      setClientId(null);
      setRecipes([]);
      setMealLogs([]);
      setCustomMeals([]);
      setPlannedMeals([]);
      setLoading(false);
      return;
    }

    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .select("id")
      .eq("profile_id", user.id)
      .single();

    if (clientError || !clientData) {
      setClientId(null);
      setRecipes([]);
      setMealLogs([]);
      setCustomMeals([]);
      setPlannedMeals([]);
      setLoading(false);
      return;
    }

    setClientId(clientData.id);

    const [recipesRes, logsRes, customsRes, plansRes] = await Promise.all([
      supabase
        .from("recipes")
        .select("id, name, description, calories, image_url")
        .order("name", { ascending: true }),
      supabase
        .from("meal_logs")
        .select("id, recipe_id, client_id, log_date, completed, quantity, recipes(name, calories)")
        .eq("client_id", clientData.id)
        .eq("log_date", selectedDate)
        .eq("completed", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("custom_meal_logs")
        .select("*")
        .eq("client_id", clientData.id)
        .eq("log_date", selectedDate)
        .order("created_at", { ascending: false }),
      supabase
        .from("meal_plans")
        .select("id, recipe_id, quantity, recipes(name, calories)")
        .eq("client_id", clientData.id)
        .eq("planned_date", selectedDate)
        .order("created_at", { ascending: true }),
    ]);

    if (!recipesRes.error && recipesRes.data) setRecipes(recipesRes.data);
    else setRecipes([]);

    if (!logsRes.error && logsRes.data) {
      const normalized: MealLog[] = logsRes.data.map((item: any) => {
        const r = Array.isArray(item.recipes) ? item.recipes[0] ?? null : item.recipes ?? null;
        return {
          id: item.id,
          recipe_id: item.recipe_id,
          client_id: item.client_id,
          log_date: item.log_date,
          completed: item.completed,
          quantity: item.quantity ?? 1,
          recipes: r ? { name: r.name ?? "", calories: r.calories ?? null } : null,
        };
      });
      setMealLogs(normalized);
    } else {
      setMealLogs([]);
    }

    if (!customsRes.error && customsRes.data) setCustomMeals(customsRes.data);
    else setCustomMeals([]);

    if (!plansRes.error && plansRes.data) {
      const normalized: PlannedMeal[] = plansRes.data.map((item: any) => {
        const r = Array.isArray(item.recipes) ? item.recipes[0] ?? null : item.recipes ?? null;
        return {
          id: item.id,
          recipe_id: item.recipe_id,
          quantity: item.quantity ?? 1,
          recipes: r ? { name: r.name ?? "", calories: r.calories ?? null } : null,
        };
      });
      setPlannedMeals(normalized);
    } else {
      setPlannedMeals([]);
    }

    setLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  // --- Date navigation ---

  const navigateToDate = (newDate: string) => {
    if (newDate > todayStr()) return; // No future logging.
    router.push(`/client/nutrition?date=${newDate}`);
  };

  const goToPreviousDay = () => navigateToDate(addDays(selectedDate, -1));
  const goToNextDay = () => navigateToDate(addDays(selectedDate, 1));
  const goToToday = () => navigateToDate(todayStr());

  // --- Mutations ---

  const insertMealLog = async (recipeId: string) => {
    if (!clientId) return null;

    const { data, error } = await supabase
      .from("meal_logs")
      .insert([
        {
          client_id: clientId,
          recipe_id: recipeId,
          log_date: selectedDate,
          completed: true,
          quantity: 1,
        },
      ])
      .select("id, recipe_id, client_id, log_date, completed, quantity, recipes(name, calories)")
      .single();

    if (error || !data) return null;

    const r = Array.isArray((data as any).recipes)
      ? (data as any).recipes[0] ?? null
      : (data as any).recipes ?? null;

    return {
      id: data.id,
      recipe_id: data.recipe_id,
      client_id: data.client_id,
      log_date: data.log_date,
      completed: data.completed,
      quantity: data.quantity ?? 1,
      recipes: r ? { name: r.name ?? "", calories: r.calories ?? null } : null,
    } as MealLog;
  };

 const handleLogPlannedMeal = async (chipPlannedId: string, recipeId: string) => {
  if (!clientId) return;
  setLoggingPlannedId(chipPlannedId);

  const inserted = await insertMealLog(recipeId);

  if (!inserted) {
    alert("Error logging meal");
    setLoggingPlannedId(null);
    return;
  }

  setMealLogs((prev) => [inserted, ...prev]);
  setLoggingPlannedId(null);

  await updateStreak(clientId, "nutrition", selectedDate);
  await awardBondXp(clientId, 10, "logged_planned_meal", "Logged a planned meal");
};

const handleAddRecipeMeal = async () => {
  if (!clientId) {
    alert("Client not found");
    return;
  }
  if (!selectedRecipeId) {
    alert("Please choose a recipe");
    return;
  }

  setAddingRecipe(true);
  const inserted = await insertMealLog(selectedRecipeId);

  if (!inserted) {
    alert("Error adding recipe meal");
    setAddingRecipe(false);
    return;
  }

  setMealLogs((prev) => [inserted, ...prev]);
  setSelectedRecipeId("");
  setAddingRecipe(false);

  await updateStreak(clientId, "nutrition", selectedDate);
  await awardBondXp(clientId, 10, "logged_off_plan_meal", "Logged an off-plan recipe meal");
};

  const handleRemoveRecipeMeal = async (mealId: string) => {
    setRemovingMealId(mealId);
    const { error } = await supabase.from("meal_logs").delete().eq("id", mealId);
    if (error) {
      alert("Error removing meal");
      setRemovingMealId(null);
      return;
    }
    setMealLogs((prev) => prev.filter((m) => m.id !== mealId));
    setRemovingMealId(null);
  };

const handleAddCustomMeal = async () => {
  if (!clientId) {
    alert("Client not found");
    return;
  }
  if (customMealName.trim() === "" || customMealCalories.trim() === "") {
    alert("Please add a meal name and calories");
    return;
  }

  setSavingCustomMeal(true);

  const { data, error } = await supabase
    .from("custom_meal_logs")
    .insert([
      {
        client_id: clientId,
        meal_name: customMealName.trim(),
        calories: Number(customMealCalories),
        log_date: selectedDate,
        note: customMealNote.trim() || null,
      },
    ])
    .select()
    .single();

  if (error) {
    alert("Error saving custom meal");
    setSavingCustomMeal(false);
    return;
  }

  setCustomMeals((prev) => [data, ...prev]);
  setCustomMealName("");
  setCustomMealCalories("");
  setCustomMealNote("");
  setSavingCustomMeal(false);

  await updateStreak(clientId, "nutrition", selectedDate);
  await awardBondXp(clientId, 10, "logged_custom_meal", "Logged a custom meal");
};

  const handleRemoveCustomMeal = async (mealId: string) => {
    setRemovingCustomMealId(mealId);
    const { error } = await supabase.from("custom_meal_logs").delete().eq("id", mealId);
    if (error) {
      alert("Error removing custom meal");
      setRemovingCustomMealId(null);
      return;
    }
    setCustomMeals((prev) => prev.filter((m) => m.id !== mealId));
    setRemovingCustomMealId(null);
  };

const handleRemoveEatenMeal = async (meal: EatenMeal) => {
  if (meal.source === "recipe") {
    await handleRemoveRecipeMeal(meal.removeId);
  } else {
    await handleRemoveCustomMeal(meal.removeId);
  }
};

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className={styles.display}>Nutrition</h1>
        <GuideLink guide="nutrition" label="Watch Peter's nutrition guide" />
      </div>

      {/* Date selector */}
      <div className={`${styles.card} mt-6 bg-surface-sunken`}>
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={goToPreviousDay}
            className={styles.buttonSecondary}
            aria-label="Previous day"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              {isToday ? "Today" : "Logging for"}
            </p>
            <p className="text-base font-semibold text-ink md:text-lg">
              {formatLongDate(selectedDate)}
            </p>
            {!isToday && (
              <button
                type="button"
                onClick={goToToday}
                className="mt-1 text-xs font-medium text-emerald hover:underline"
              >
                Jump to today
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={goToNextDay}
            disabled={isToday}
            className={`${styles.buttonSecondary} ${isToday ? "opacity-30" : ""}`}
            aria-label="Next day"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {clientId && <ClientUnreadRepliesBanner clientId={clientId} />}

        {/* Calorie summary */}
        <div className={`${styles.card} bg-surface-sunken`}>
          <h2 className={styles.h2}>Calories {isToday ? "Today" : "for the day"}</h2>
          <p className="mt-2 text-2xl font-bold text-ink">{totalCalories} kcal</p>
          <p className="mt-1 text-sm text-ink-muted">{formatLongDate(selectedDate)}</p>
        </div>

        {clientId && (
          <MessageTrainerBox
            clientId={clientId}
            contextType="nutrition"
            contextId={selectedDate}
            contextLabel={`Nutrition - ${formatLongDate(selectedDate)}`}
            title="Nutrition question"
            placeholder="Ask about meals, travel, swaps, or anything nutrition-related..."
            accent="nutrition"
            showRecentMessages={false}
          />
        )}

        {/* Three quick links */}
        <div className="grid gap-4 md:grid-cols-3">
          <Link
            href="/client/meal-planner"
            className={`${styles.cardInteractive} border border-emerald bg-surface-sunken`}
          >
            <p className="text-xl font-bold text-emerald">Planner</p>
            <p className="mt-1 text-lg font-semibold text-ink">Plan meals ahead of time</p>
            <p className="mt-2 textxs text-ink-muted">
              Build your upcoming meals before the day arrives
            </p>
          </Link>

          <Link
            href="/client/shopping-list"
            className={`${styles.cardInteractive} border border-emerald bg-surface-sunken`}
          >
            <p className="text-xl font-bold text-emerald">Shopping List</p>
            <p className="mt-1 text-lg font-semibold text-ink">
              Collated ingredients from planned meals
            </p>
            <p className="mt-2 text-sm text-ink-muted">
              Generate a list based on your current meal plan
            </p>
          </Link>

          <Link href="/recipes" className={`${styles.cardInteractive} border border-emerald bg-surface-sunken`}>
            <p className="text-xl font-bold text-emerald"> Menu</p>
            <p className="mt-1 text-lg font-semibold text-ink">Browse all available recipes</p>
            <p className="mt-2 text-sm text-ink-muted">
              View full recipe details, ingredients, and nutrition info
            </p>
          </Link>
        </div>

        {/* From your plan — chips */}
        {!isFuture && unfulfilledChips.length > 0 && (
          <div className={styles.card}>
            <h2 className={styles.h2}>From your plan</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Tap a meal to log it as eaten.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {unfulfilledChips.map((chip, idx) => {
                // Use a synthetic key — chips can repeat for the same recipe.
                const key = `${chip.id}-${idx}`;
                const isLogging = loggingPlannedId === key;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={isLogging}
                    onClick={() => handleLogPlannedMeal(key, chip.recipe_id)}
                    className="flex items-center gap-2 rounded-full border border-emerald bg-emerald/5 px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-emerald hover:text-white disabled:opacity-50"
                  >
                    <Plus size={14} />
                    {chip.recipes?.name ?? "Unnamed"}
                    {chip.recipes?.calories !== null && chip.recipes?.calories !== undefined && (
                      <span className="text-xs text-ink-muted group-hover:text-white/80">
                        ({chip.recipes.calories} kcal)
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

{/* Merged eaten meals list */}
<div className={styles.card}>
  <h2 className={styles.h2}>
    {isToday ? "What I've eaten today" : "Meals"}
  </h2>
  <div className="mt-4 space-y-2">
    {eatenMeals.length === 0 ? (
      <p className={styles.body}>No meals logged.</p>
    ) : (
      eatenMeals.map((meal) => {
        const isRemoving =
          (meal.source === "recipe" && removingMealId === meal.removeId) ||
          (meal.source === "custom" && removingCustomMealId === meal.removeId);

        return (
          <div
            key={meal.key}
            className="flex items-start justify-between gap-3 rounded-lg border border-border-subtle px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium text-ink">
                  {meal.name}
                </p>
                {meal.source === "custom" && (
                  <span className="shrink-0 rounded-full border border-border-subtle px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
                    Custom
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-ink-muted">
                {meal.calories} kcal
              </p>
              {meal.note && (
                <p className="mt-1 text-xs text-ink-muted">{meal.note}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => handleRemoveEatenMeal(meal)}
              disabled={isRemoving}
              className="shrink-0 rounded-xl border border-red-300 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        );
      })
    )}
  </div>
</div>


        {/* Add recipe meal — moved to bottom */}
        <div className={styles.card}>
          <h2 className={styles.h2}>Manually Add Recipe Meal</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Use this if you ate a recipe that wasn't on your plan for the day.
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <label className="text-sm font-medium text-ink">Choose a recipe</label>
              <select
                value={selectedRecipeId}
                onChange={(e) => setSelectedRecipeId(e.target.value)}
                className={styles.input}
              >
                <option value="">Select a recipe</option>
                {recipes.map((recipe) => (
                  <option key={recipe.id} value={recipe.id}>
                    {recipe.name}
                    {recipe.calories !== null ? ` (${recipe.calories} kcal)` : ""}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleAddRecipeMeal}
              disabled={addingRecipe}
              className={styles.buttonPrimaryNutrition}
            >
              {addingRecipe ? "Adding..." : "Add to Eaten Meals"}
            </button>
          </div>
        </div>


        {/* Add custom meal */}
        <div className={styles.card}>
          <h2 className={styles.h2}>Add Custom Meal</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-ink">Meal name</label>
              <input
                type="text"
                value={customMealName}
                onChange={(e) => setCustomMealName(e.target.value)}
                className={styles.input}
                placeholder="e.g. Nando's pitta meal"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-ink">Calories</label>
              <input
                type="number"
                value={customMealCalories}
                onChange={(e) => setCustomMealCalories(e.target.value)}
                className={styles.input}
                placeholder="600"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="text-sm font-medium text-ink">Note</label>
            <input
              type="text"
              value={customMealNote}
              onChange={(e) => setCustomMealNote(e.target.value)}
              className={styles.input}
              placeholder="Optional note"
            />
          </div>

          <button
            onClick={handleAddCustomMeal}
            disabled={savingCustomMeal}
            className={`${styles.buttonPrimaryNutrition} mt-4`}
          >
            {savingCustomMeal ? "Saving..." : "Add Custom Meal"}
          </button>
        </div>


      </div>
    </>
  );
}
