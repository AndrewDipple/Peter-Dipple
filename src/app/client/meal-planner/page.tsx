"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";
import {
  todayStr,
  addDays,
  getMondayOf,
  buildWeekDates,
  formatShortDate,
  formatLongDate,
  formatWeekLabel,
  DAY_LABELS,
} from "@/lib/dates";
import { ChevronLeft, ChevronRight, Plus, X, ArrowRightLeft } from "lucide-react";

type Client = {
  id: string;
  full_name: string;
  profile_id: string | null;
  calorie_target: number | null;
};

type Recipe = {
  id: string;
  name: string;
  description: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

type MealPlan = {
  id: string;
  client_id: string;
  recipe_id: string;
  planned_date: string;
  quantity: number;
  recipes: {
    name: string;
    calories: number | null;
    description: string | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
  } | null;
};

const sumDailyCalories = (meals: MealPlan[]): number =>
  meals.reduce((sum, m) => {
    const cals = m.recipes?.calories ?? 0;
    const qty = m.quantity ?? 1;
    return sum + cals * qty;
  }, 0);

  const sumDailyMacros = (meals: MealPlan[]): { protein: number; carbs: number; fat: number } => {
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  for (const m of meals) {
    const qty = m.quantity ?? 1;
    protein += (m.recipes?.protein_g ?? 0) * qty;
    carbs += (m.recipes?.carbs_g ?? 0) * qty;
    fat += (m.recipes?.fat_g ?? 0) * qty;
  }
  return { protein, carbs, fat };
};
export default function ClientMealPlannerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [client, setClient] = useState<Client | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [plannedMeals, setPlannedMeals] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);

  // Add-meal modal state
  const [modalOpenForDate, setModalOpenForDate] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [modalQuantity, setModalQuantity] = useState("1");
  const [addingMeal, setAddingMeal] = useState(false);

  const [movingMealId, setMovingMealId] = useState<string | null>(null);
  const [removingMealId, setRemovingMealId] = useState<string | null>(null);

  const [copyingWeek, setCopyingWeek] = useState(false);

  // Resolve focused date from URL or default to today.
  const focusedDate = useMemo(() => {
    const param = searchParams.get("date");
    return param || todayStr();
  }, [searchParams]);

  const weekStart = useMemo(() => getMondayOf(focusedDate), [focusedDate]);
  const weekDates = useMemo(() => buildWeekDates(weekStart), [weekStart]);
  const weekEnd = weekDates[6];

  const focusedIndex = weekDates.indexOf(focusedDate);
  const focusedDayOfWeek = focusedIndex >= 0 ? focusedIndex : 0;

  // --- Data loading ---

  const loadPage = useCallback(async () => {
    setLoading(true);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      setClient(null);
      setLoading(false);
      return;
    }

    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .select("id, full_name, profile_id, calorie_target")
      .eq("profile_id", user.id)
      .single();

    if (clientError || !clientData) {
      setClient(null);
      setLoading(false);
      return;
    }

    setClient(clientData);

    const [recipesRes, plansRes] = await Promise.all([
      supabase
        .from("recipes")
        .select("id, name, description, calories, protein_g, carbs_g, fat_g")
        .order("name", { ascending: true }),
      supabase
        .from("meal_plans")
        .select(
          "id, client_id, recipe_id, planned_date, quantity, recipes(name, calories, description, protein_g, carbs_g, fat_g)"
        )
        .eq("client_id", clientData.id)
        .gte("planned_date", weekStart)
        .lte("planned_date", weekEnd)
        .order("created_at", { ascending: true }),
    ]);

    if (!recipesRes.error && recipesRes.data) setRecipes(recipesRes.data);
    else setRecipes([]);

    if (!plansRes.error && plansRes.data) {
      const normalized: MealPlan[] = plansRes.data.map((item: any) => {
        const r = Array.isArray(item.recipes) ? item.recipes[0] ?? null : item.recipes ?? null;
        return {
          id: item.id,
          client_id: item.client_id,
          recipe_id: item.recipe_id,
          planned_date: item.planned_date,
          quantity: item.quantity ?? 1,
          recipes: r
            ? {
                name: r.name ?? "",
                calories: r.calories ?? null,
                description: r.description ?? null,
                protein_g: r.protein_g ?? null,
                carbs_g: r.carbs_g ?? null,
                fat_g: r.fat_g ?? null,
              }
            : null,
        };
      });
      setPlannedMeals(normalized);
    } else {
      setPlannedMeals([]);
    }

    setLoading(false);
  }, [weekStart, weekEnd]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  // --- Navigation ---

  const navigateToDate = (newDate: string) => {
    router.push(`/client/meal-planner?date=${newDate}`);
  };

  // Prev/next week preserves the focused day-of-week.
  const goToPreviousWeek = () => navigateToDate(addDays(focusedDate, -7));
  const goToNextWeek = () => navigateToDate(addDays(focusedDate, 7));
  const goToThisWeek = () => navigateToDate(todayStr());

  const isCurrentWeek = weekStart === getMondayOf(todayStr());

  // --- Derived data ---

  const filteredRecipes = useMemo(() => {
    if (!searchQuery.trim()) return recipes;
    const query = searchQuery.toLowerCase();
    return recipes.filter((recipe) => {
      const name = recipe.name?.toLowerCase() || "";
      const description = recipe.description?.toLowerCase() || "";
      return name.includes(query) || description.includes(query);
    });
  }, [recipes, searchQuery]);

  const mealsByDate = useMemo(() => {
    const map: Record<string, MealPlan[]> = {};
    for (const date of weekDates) map[date] = [];
    for (const meal of plannedMeals) {
      if (map[meal.planned_date]) map[meal.planned_date].push(meal);
    }
    return map;
  }, [plannedMeals, weekDates]);

  const focusedMeals = mealsByDate[focusedDate] ?? [];

  // --- Mutations ---

  const closeAddModal = () => {
    setModalOpenForDate(null);
    setSearchQuery("");
    setSelectedRecipeId("");
    setModalQuantity("1");
  };

  const handleAddMeal = async () => {
    if (!client || !modalOpenForDate || !selectedRecipeId) return;

    const qty = Math.max(1, Number(modalQuantity) || 1);
    setAddingMeal(true);

    const rows = Array.from({ length: qty }, () => ({
      client_id: client.id,
      recipe_id: selectedRecipeId,
      planned_date: modalOpenForDate,
      quantity: 1,
    }));

    const { error } = await supabase.from("meal_plans").insert(rows);

    if (error) {
      alert("Error adding planned meal");
      setAddingMeal(false);
      return;
    }

    setAddingMeal(false);
    closeAddModal();
    await loadPage();
  };

  const handleRemoveMeal = async (mealId: string) => {
    setRemovingMealId(mealId);
    const { error } = await supabase.from("meal_plans").delete().eq("id", mealId);
    if (error) {
      alert("Error removing planned meal");
      setRemovingMealId(null);
      return;
    }
    setPlannedMeals((prev) => prev.filter((m) => m.id !== mealId));
    setRemovingMealId(null);
  };

  const handleMoveMeal = async (mealId: string, newDate: string) => {
    setMovingMealId(null);

    const { error } = await supabase
      .from("meal_plans")
      .update({ planned_date: newDate })
      .eq("id", mealId);

    if (error) {
      alert("Error moving meal");
      return;
    }
    



    await loadPage();
  };

  const handleCopyLastWeek = async () => {
  if (!client) return;

  const lastWeekStart = addDays(weekStart, -7);
  const lastWeekEnd = addDays(weekStart, -1);

  setCopyingWeek(true);

  // Fetch last week's meals.
  const { data: lastWeekMeals, error: fetchError } = await supabase
    .from("meal_plans")
    .select("recipe_id, planned_date, quantity")
    .eq("client_id", client.id)
    .gte("planned_date", lastWeekStart)
    .lte("planned_date", lastWeekEnd);

  if (fetchError) {
    alert("Could not read last week's meals.");
    setCopyingWeek(false);
    return;
  }

  if (!lastWeekMeals || lastWeekMeals.length === 0) {
    alert("Last week has no meals to copy.");
    setCopyingWeek(false);
    return;
  }

  const count = lastWeekMeals.length;
  const confirmed = window.confirm(
    `Copy ${count} meal${count === 1 ? "" : "s"} from last week into this week? Existing meals will be kept.`
  );

  if (!confirmed) {
    setCopyingWeek(false);
    return;
  }

  // Build the new rows — shift each planned_date forward by 7 days.
  const newRows = lastWeekMeals.map((m: any) => ({
    client_id: client.id,
    recipe_id: m.recipe_id,
    planned_date: addDays(m.planned_date, 7),
    quantity: m.quantity ?? 1,
  }));

  const { error: insertError } = await supabase.from("meal_plans").insert(newRows);

  if (insertError) {
    alert(`Could not copy meals: ${insertError.message}`);
    setCopyingWeek(false);
    return;
  }

  setCopyingWeek(false);
  await loadPage();
};

  // --- Daily summary ---

  const planned = sumDailyCalories(focusedMeals);
  const target = client?.calorie_target ?? null;
  const remaining = target !== null ? target - planned : null;
  const isOver = remaining !== null && remaining < 0;

  const today = todayStr();

  return (
    <>
      <h1 className={styles.display}>Meal Planner</h1>

      <div className="mt-6 mb-6">
        <Link
          href="/client/shopping-list"
          className={`${styles.cardInteractive} bg-surface-sunken block`}
        >
          <p className="text-sm text-ink-muted">Shopping List</p>
          <p className="mt-1 text-lg font-semibold text-ink">
            View collated ingredients from your meal plan
          </p>
          <p className="mt-2 text-sm text-ink-muted">
            Generate a combined list from your planned meals
          </p>
        </Link>
      </div>

      {/* Week selector */}
<div className={`${styles.card} bg-surface-sunken`}>
  <div className="flex items-center justify-between gap-3">
    <button
      type="button"
      onClick={goToPreviousWeek}
      className={styles.buttonSecondary}
      aria-label="Previous week"
    >
      <ChevronLeft size={16} />
    </button>

    <div className="text-center">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Week of</p>
      <p className="text-base font-semibold text-ink md:text-lg">
        {formatWeekLabel(weekStart)}
      </p>
      {!isCurrentWeek && (
        <button
          type="button"
          onClick={goToThisWeek}
          className="mt-1 text-xs font-medium text-emerald hover:underline"
        >
          Jump to this week
        </button>
      )}
    </div>

    <button
      type="button"
      onClick={goToNextWeek}
      className={styles.buttonSecondary}
      aria-label="Next week"
    >
      <ChevronRight size={16} />
    </button>
  </div>

  <div className="mt-3 flex justify-center border-t border-border-subtle pt-3">
    <button
      type="button"
      onClick={handleCopyLastWeek}
      disabled={copyingWeek}
      className="text-sm font-medium text-emerald hover:underline disabled:opacity-50 disabled:no-underline"
    >
      {copyingWeek ? "Copying..." : "Copy from last week"}
    </button>
  </div>
</div>

      {loading ? (
        <p className={`${styles.body} mt-6`}>Loading planner...</p>
      ) : !client ? (
        <p className={`${styles.body} mt-6`}>Client not found.</p>
      ) : (
        <>
          {/* Week strip */}
          <div className="mt-6 grid grid-cols-7 gap-1.5 md:gap-2">
            {weekDates.map((date, i) => {
              const isFocused = date === focusedDate;
              const isToday = date === today;
              const dayMeals = mealsByDate[date] ?? [];
              const dayCalories = sumDailyCalories(dayMeals);

              // Layered classes: base / today (gold border) / focused (filled emerald).
              // Focused wins on background, today wins on border.
              const baseClasses =
                "flex flex-col items-center justify-start rounded-lg border p-2 text-center transition";
              const colourClasses = isFocused
                ? "bg-emerald text-white"
                : "bg-surface text-ink hover:bg-surface-sunken";
              const borderClasses = isToday
                ? "border-gold border-2"
                : "border-border-subtle";

              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => navigateToDate(date)}
                  className={`${baseClasses} ${colourClasses} ${borderClasses}`}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wide opacity-80 md:text-xs">
                    {DAY_LABELS[i]}
                  </div>
                  <div className="text-sm font-bold md:text-base">
                    {formatShortDate(date).split(" ")[0]}
                  </div>
                  <div
                    className={`mt-1 text-[10px] font-medium md:text-xs ${
                      isFocused ? "text-white/90" : "text-ink-muted"
                    }`}
                  >
                    {dayCalories > 0 ? `${dayCalories}` : "—"}
                  </div>
                  <div
                    className={`text-[9px] uppercase tracking-wide md:text-[10px] ${
                      isFocused ? "text-white/70" : "text-ink-muted"
                    }`}
                  >
                    kcal
                  </div>
                </button>
              );
            })}
          </div>

          {/* Focused day detail */}
          <div className={`${styles.card} mt-4`}>
            <div className="flex items-baseline justify-between">
              <h2 className={styles.h2}>{formatLongDate(focusedDate)}</h2>
              <span className="text-xs font-medium text-ink-muted">
                {focusedMeals.length > 0
                  ? `${focusedMeals.length} meal${focusedMeals.length === 1 ? "" : "s"}`
                  : "—"}
              </span>
            </div>

<p className="mt-2 text-sm font-medium text-ink-muted">
  Planned: {planned} kcal
  {target !== null && (
    <>
      {" · "}
      <span className={isOver ? "text-red-600" : "text-ink"}>
        {isOver ? `${Math.abs(remaining!)} over` : `${remaining} remaining`}
      </span>
    </>
  )}
</p>
{(() => {
  const { protein, carbs, fat } = sumDailyMacros(focusedMeals);
  const totalGrams = protein + carbs + fat;
  const pct = (n: number) =>
    totalGrams > 0 ? `${Math.round((n / totalGrams) * 100)}%` : null;

  return (
    <p className="mt-1 text-xs text-ink-muted">
      Protein: {Math.round(protein)}g
      {pct(protein) && ` (${pct(protein)})`}
      {" · "}
      Carbs: {Math.round(carbs)}g
      {pct(carbs) && ` (${pct(carbs)})`}
      {" · "}
      Fat: {Math.round(fat)}g
      {pct(fat) && ` (${pct(fat)})`}
    </p>
  );
})()}

            <div className="mt-4 space-y-2">
              {focusedMeals.length === 0 ? (
                <p className="text-sm text-ink-muted">No meals planned.</p>
              ) : (
                focusedMeals.map((meal) => (
                  <div key={meal.id} className="rounded-lg border border-border-subtle px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                        {meal.recipes?.name || "Unnamed meal"}
                      </p>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setMovingMealId(movingMealId === meal.id ? null : meal.id)
                          }
                          className="rounded-md border border-border-subtle p-1.5 text-ink hover:border-emerald hover:text-emerald"
                          aria-label="Move meal"
                        >
                          <ArrowRightLeft size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveMeal(meal.id)}
                          disabled={removingMealId === meal.id}
                          className="rounded-md border border-red-300 p-1.5 text-red-600 hover:bg-red-50"
                          aria-label="Remove meal"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>

                    {movingMealId === meal.id && (
                      <div className="mt-2 rounded-md border border-border-subtle bg-surface-sunken p-2">
                        <p className="mb-1.5 text-xs font-medium text-ink-muted">Move to:</p>
                        <div className="grid grid-cols-7 gap-1">
                          {weekDates.map((d, i) => {
                            const isCurrent = d === meal.planned_date;
                            return (
                              <button
                                key={d}
                                type="button"
                                disabled={isCurrent}
                                onClick={() => handleMoveMeal(meal.id, d)}
                                className={`rounded-md px-1 py-1 text-xs font-medium transition ${
                                  isCurrent
                                    ? "cursor-not-allowed bg-surface-sunken text-ink-muted opacity-50"
                                    : "border border-border-subtle text-ink hover:border-emerald hover:text-emerald"
                                }`}
                              >
                                {DAY_LABELS[i]}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}

              <button
                type="button"
                onClick={() => setModalOpenForDate(focusedDate)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border-subtle px-3 py-3 text-sm font-medium text-ink-muted hover:border-emerald hover:text-emerald"
              >
                <Plus size={16} /> Add meal
              </button>
            </div>
          </div>
        </>
      )}

      {/* Add meal modal */}
      {modalOpenForDate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-lg bg-white shadow-lifted">
            <div className="flex items-start justify-between border-b border-gray-200 p-5">
              <div>
                <h2 className="text-xl font-semibold text-black">Add Meal</h2>
                <p className="mt-1 text-sm text-gray-600">{formatLongDate(modalOpenForDate)}</p>
              </div>
              <button
                type="button"
                onClick={closeAddModal}
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto p-5">
              <div>
                <label className="text-sm font-medium text-black">Search recipes</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Start typing to filter..."
                  autoFocus
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 placeholder:text-gray-400 focus:border-black focus:outline-none"
                  style={{ backgroundColor: "#ffffff", color: "#000000" }}
                />
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-black">
                  {filteredRecipes.length === 0
                    ? "No recipes match"
                    : `${filteredRecipes.length} recipe${filteredRecipes.length === 1 ? "" : "s"}`}
                </p>
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-gray-200 p-1">
                  {filteredRecipes.map((recipe) => {
                    const isSelected = recipe.id === selectedRecipeId;
                    return (
                      <button
                        key={recipe.id}
                        type="button"
                        onClick={() => setSelectedRecipeId(recipe.id)}
                        className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition ${
                          isSelected ? "bg-black text-white" : "text-black hover:bg-gray-100"
                        }`}
                      >
                        <span className="font-medium">{recipe.name}</span>
                        {recipe.calories !== null && (
                          <span className={`text-xs ${isSelected ? "text-gray-300" : "text-gray-500"}`}>
                            {recipe.calories} kcal
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-black">Number of meals</label>
                <input
                  type="number"
                  min="1"
                  value={modalQuantity}
                  onChange={(e) => setModalQuantity(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-black focus:outline-none"
                  style={{ backgroundColor: "#ffffff", color: "#000000" }}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Adds this many separate meals to the day. Each can be moved or removed independently.
                </p>
              </div>
            </div>

            <div className="flex gap-2 border-t border-gray-200 p-5">
              <button
                onClick={handleAddMeal}
                disabled={addingMeal || !selectedRecipeId}
                className="flex-1 rounded-md bg-black px-4 py-2.5 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {addingMeal ? "Adding..." : "Add to Plan"}
              </button>
              <button
                onClick={closeAddModal}
                className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2.5 font-medium text-black hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}