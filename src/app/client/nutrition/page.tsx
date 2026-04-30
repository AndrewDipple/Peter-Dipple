"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";
import { updateStreak } from "@/lib/streaks";

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

export default function ClientNutritionPage() {
  const [clientId, setClientId] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [mealLogs, setMealLogs] = useState<MealLog[]>([]);
  const [customMeals, setCustomMeals] = useState<CustomMeal[]>([]);
  const [todayCalories, setTodayCalories] = useState(0);
  const [loading, setLoading] = useState(true);

  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [addingRecipe, setAddingRecipe] = useState(false);
  const [updatingMealId, setUpdatingMealId] = useState<string | null>(null);
  const [removingMealId, setRemovingMealId] = useState<string | null>(null);

  const [customMealName, setCustomMealName] = useState("");
  const [customMealCalories, setCustomMealCalories] = useState("");
  const [customMealNote, setCustomMealNote] = useState("");
  const [savingCustomMeal, setSavingCustomMeal] = useState(false);
  const [removingCustomMealId, setRemovingCustomMealId] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

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

  useEffect(() => {
    loadPage();
  }, [today]);

  const loadPage = async () => {
    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setClientId(null);
      setRecipes([]);
      setMealLogs([]);
      setCustomMeals([]);
      setTodayCalories(0);
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
      setTodayCalories(0);
      setLoading(false);
      return;
    }

    setClientId(clientData.id);

    const { data: recipeData, error: recipeError } = await supabase
      .from("recipes")
      .select("id, name, description, calories, image_url")
      .order("name", { ascending: true });

    if (!recipeError && recipeData) {
      setRecipes(recipeData);
    } else {
      setRecipes([]);
    }

    const { data: mealData, error: mealError } = await supabase
      .from("meal_logs")
      .select("id, recipe_id, client_id, log_date, completed, quantity, recipes(name, calories)")
      .eq("client_id", clientData.id)
      .eq("log_date", today)
      .eq("completed", true)
      .order("created_at", { ascending: false });

    if (!mealError && mealData) {
      const normalizedMealLogs: MealLog[] = mealData.map((item: any) => {
        const recipeData = Array.isArray(item.recipes)
          ? item.recipes[0] ?? null
          : item.recipes ?? null;

        return {
          id: item.id,
          recipe_id: item.recipe_id,
          client_id: item.client_id,
          log_date: item.log_date,
          completed: item.completed,
          quantity: item.quantity ?? 1,
          recipes: recipeData
            ? {
                name: recipeData.name ?? "",
                calories: recipeData.calories ?? null,
              }
            : null,
        };
      });

      setMealLogs(normalizedMealLogs);
    } else {
      setMealLogs([]);
    }

    const { data: customMealData, error: customMealError } = await supabase
      .from("custom_meal_logs")
      .select("*")
      .eq("client_id", clientData.id)
      .eq("log_date", today)
      .order("created_at", { ascending: false });

    if (!customMealError && customMealData) {
      setCustomMeals(customMealData);
    } else {
      setCustomMeals([]);
    }

    const recipeTotal =
      !mealError && mealData
        ? mealData.reduce((sum: number, item: any) => {
            const recipeCalories = Array.isArray(item.recipes)
              ? item.recipes[0]?.calories
              : item.recipes?.calories;

            const quantity = item.quantity ?? 1;
            return sum + (recipeCalories ?? 0) * quantity;
          }, 0)
        : 0;

    const customTotal =
      !customMealError && customMealData
        ? customMealData.reduce((sum, meal) => sum + (meal.calories ?? 0), 0)
        : 0;

    setTodayCalories(recipeTotal + customTotal);
    setLoading(false);
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

  const existingMeal = mealLogs.find((meal) => meal.recipe_id === selectedRecipeId);

  if (existingMeal) {
    const currentQuantity = existingMeal.quantity ?? 1;

    const { error } = await supabase
      .from("meal_logs")
      .update({
        quantity: currentQuantity + 1,
        completed: true,
      })
      .eq("id", existingMeal.id);

    if (error) {
      alert("Error updating meal quantity");
      setAddingRecipe(false);
      return;
    }
  } else {
    const { error } = await supabase.from("meal_logs").insert([
      {
        client_id: clientId,
        recipe_id: selectedRecipeId,
        log_date: today,
        completed: true,
        quantity: 1,
      },
    ]);

    if (error) {
      alert("Error adding recipe meal");
      setAddingRecipe(false);
      return;
    }
  }

  setSelectedRecipeId("");
  setAddingRecipe(false);
  await loadPage();

  // 🔥 UPDATE NUTRITION STREAK (trigger on any meal logged)
  await updateStreak(clientId, "nutrition", today);
};

  const handleQuantityChange = async (mealId: string, newQuantity: number) => {
    if (newQuantity < 1) return;

    setUpdatingMealId(mealId);

    const { error } = await supabase
      .from("meal_logs")
      .update({ quantity: newQuantity })
      .eq("id", mealId);

    if (error) {
      alert("Error updating quantity");
      setUpdatingMealId(null);
      return;
    }

    setMealLogs((prev) =>
      prev.map((meal) =>
        meal.id === mealId ? { ...meal, quantity: newQuantity } : meal
      )
    );

    setUpdatingMealId(null);
  };

  const handleRemoveRecipeMeal = async (mealId: string) => {
    setRemovingMealId(mealId);

    const { error } = await supabase.from("meal_logs").delete().eq("id", mealId);

    if (error) {
      alert("Error removing meal");
      setRemovingMealId(null);
      return;
    }

    setMealLogs((prev) => prev.filter((meal) => meal.id !== mealId));
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
        log_date: today,
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

  // 🔥 UPDATE NUTRITION STREAK
  await updateStreak(clientId, "nutrition", today);
};

  const handleRemoveCustomMeal = async (mealId: string) => {
    setRemovingCustomMealId(mealId);

    const { error } = await supabase
      .from("custom_meal_logs")
      .delete()
      .eq("id", mealId);

    if (error) {
      alert("Error removing custom meal");
      setRemovingCustomMealId(null);
      return;
    }

    setCustomMeals((prev) => prev.filter((meal) => meal.id !== mealId));
    setRemovingCustomMealId(null);
  };

  useEffect(() => {
    setTodayCalories(recipeCaloriesTotal + customCaloriesTotal);
  }, [recipeCaloriesTotal, customCaloriesTotal]);

  return (
    <>
      <h1 className={styles.display}>Nutrition</h1>

      <div className="mt-6 space-y-6">
        <div className={`${styles.card} bg-surface-sunken`}>
          <h2 className={styles.h2}>Today's Calories</h2>
          <p className="mt-2 text-2xl font-bold text-ink">
            {todayCalories} kcal
          </p>
          <p className="mt-1 text-sm text-ink-muted">{today}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Link
            href="/client/meal-planner"
            className={`${styles.cardInteractive} bg-surface-sunken`}
          >
            <p className="text-sm text-ink-muted">Meal Planner</p>
            <p className="mt-1 text-lg font-semibold text-ink">
              Plan meals ahead of time
            </p>
            <p className="mt-2 text-sm text-ink-muted">
              Build your upcoming meals before the day arrives
            </p>
          </Link>

          <Link
            href="/client/shopping-list"
            className={`${styles.cardInteractive} bg-surface-sunken`}
          >
            <p className="text-sm text-ink-muted">Shopping List</p>
            <p className="mt-1 text-lg font-semibold text-ink">
              Collated ingredients from planned meals
            </p>
            <p className="mt-2 text-sm text-ink-muted">
              Generate a list based on your current meal plan
            </p>
          </Link>

          <Link
            href="/client/recipes"
            className={`${styles.cardInteractive} bg-surface-sunken`}
          >
            <p className="text-sm text-ink-muted">Recipe Menu</p>
            <p className="mt-1 text-lg font-semibold text-ink">
              Browse all available recipes
            </p>
            <p className="mt-2 text-sm text-ink-muted">
              View full recipe details, ingredients, and nutrition info
            </p>
          </Link>
        </div>

        <div className={styles.card}>
          <h2 className={styles.h2}>Add Recipe Meal</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <label className="text-sm font-medium text-ink">
                Choose a recipe
              </label>
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

        <div className={styles.card}>
          <h2 className={styles.h2}>Today's Recipe Meals</h2>

          <div className="mt-4 space-y-2">
            {mealLogs.length === 0 ? (
              <p className={styles.body}>No recipe meals logged today.</p>
            ) : (
              mealLogs.map((meal) => {
                const quantity = meal.quantity ?? 1;
                const caloriesPerMeal = meal.recipes?.calories ?? 0;
                const totalMealCalories = caloriesPerMeal * quantity;

                return (
                  <div
                    key={meal.id}
                    className="flex flex-col gap-3 rounded-lg border border-border-subtle px-3 py-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="font-medium text-ink">
                        {meal.recipes?.name || "Unnamed meal"}
                      </p>
                      <p className="text-sm text-ink-muted">
                        {caloriesPerMeal} kcal each
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleQuantityChange(meal.id, Math.max(1, quantity - 1))
                        }
                        disabled={updatingMealId === meal.id || quantity <= 1}
                        className={styles.buttonSecondary}
                      >
                        -
                      </button>

                      <span className="min-w-[90px] text-center text-sm font-medium text-ink">
                        Qty: {quantity}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleQuantityChange(meal.id, quantity + 1)}
                        disabled={updatingMealId === meal.id}
                        className={styles.buttonSecondary}
                      >
                        +
                      </button>

                      <span className="min-w-[100px] text-right text-sm font-medium text-ink">
                        {totalMealCalories} kcal
                      </span>

                      <button
                        type="button"
                        onClick={() => handleRemoveRecipeMeal(meal.id)}
                        disabled={removingMealId === meal.id}
                        className="rounded-xl border border-red-300 px-4 py-2 text-red-600 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className={styles.card}>
          <h2 className={styles.h2}>Add Custom Meal</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-ink">
                Meal name
              </label>
              <input
                type="text"
                value={customMealName}
                onChange={(e) => setCustomMealName(e.target.value)}
                className={styles.input}
                placeholder="e.g. Nando's pitta meal"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-ink">
                Calories
              </label>
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

        <div className={styles.card}>
          <h2 className={styles.h2}>Today's Custom Meals</h2>

          <div className="mt-4 space-y-2">
            {customMeals.length === 0 ? (
              <p className={styles.body}>No custom meals logged today.</p>
            ) : (
              customMeals.map((meal) => (
                <div
                  key={meal.id}
                  className="flex flex-col gap-3 rounded-lg border border-border-subtle px-3 py-3 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-medium text-ink">{meal.meal_name}</p>
                    {meal.note && (
                      <p className="text-sm text-ink-muted">{meal.note}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <p className="text-sm font-medium text-ink">
                      {meal.calories} kcal
                    </p>
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomMeal(meal.id)}
                      disabled={removingCustomMealId === meal.id}
                      className="rounded-xl border border-red-300 px-4 py-2 text-red-600 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}