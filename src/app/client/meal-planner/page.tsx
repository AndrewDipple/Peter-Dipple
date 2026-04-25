"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/PageHeader";
import { styles } from "@/lib/design";

type Client = {
  id: string;
  full_name: string;
  profile_id: string | null;
};

type Recipe = {
  id: string;
  name: string;
  calories: number | null;
  description: string | null;
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
  } | null;
};

export default function ClientMealPlannerPage() {
  const [client, setClient] = useState<Client | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [plannedMeals, setPlannedMeals] = useState<MealPlan[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [loading, setLoading] = useState(true);
  const [addingMeal, setAddingMeal] = useState(false);
  const [updatingMealId, setUpdatingMealId] = useState<string | null>(null);
  const [removingMealId, setRemovingMealId] = useState<string | null>(null);

  const plannedCalories = useMemo(() => {
    return plannedMeals.reduce((sum, meal) => {
      const calories = meal.recipes?.calories ?? 0;
      return sum + calories * (meal.quantity ?? 1);
    }, 0);
  }, [plannedMeals]);

  const loadPage = async () => {
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
      .select("id, full_name, profile_id")
      .eq("profile_id", user.id)
      .single();

    if (clientError || !clientData) {
      setClient(null);
      setLoading(false);
      return;
    }

    setClient(clientData);

    const { data: recipeData, error: recipeError } = await supabase
      .from("recipes")
      .select("id, name, calories, description")
      .order("name", { ascending: true });

    if (!recipeError && recipeData) {
      setRecipes(recipeData);
    } else {
      setRecipes([]);
    }

    const { data: planData, error: planError } = await supabase
      .from("meal_plans")
      .select("id, client_id, recipe_id, planned_date, quantity, recipes(name, calories, description)")
      .eq("client_id", clientData.id)
      .eq("planned_date", selectedDate)
      .order("created_at", { ascending: false });

    if (!planError && planData) {
      const normalizedPlans: MealPlan[] = planData.map((item: any) => {
        const recipeData = Array.isArray(item.recipes)
          ? item.recipes[0] ?? null
          : item.recipes ?? null;

        return {
          id: item.id,
          client_id: item.client_id,
          recipe_id: item.recipe_id,
          planned_date: item.planned_date,
          quantity: item.quantity ?? 1,
          recipes: recipeData
            ? {
                name: recipeData.name ?? "",
                calories: recipeData.calories ?? null,
                description: recipeData.description ?? null,
              }
            : null,
        };
      });

      setPlannedMeals(normalizedPlans);
    } else {
      setPlannedMeals([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadPage();
  }, [selectedDate]);

  const handleAddMeal = async () => {
    if (!client) {
      alert("Client not found");
      return;
    }

    if (!selectedRecipeId) {
      alert("Please select a recipe");
      return;
    }

    setAddingMeal(true);

    const existingPlan = plannedMeals.find(
      (meal) => meal.recipe_id === selectedRecipeId
    );

    if (existingPlan) {
      const { error } = await supabase
        .from("meal_plans")
        .update({ quantity: (existingPlan.quantity ?? 1) + 1 })
        .eq("id", existingPlan.id);

      if (error) {
        alert("Error updating planned meal");
        setAddingMeal(false);
        return;
      }
    } else {
      const { error } = await supabase.from("meal_plans").insert([
        {
          client_id: client.id,
          recipe_id: selectedRecipeId,
          planned_date: selectedDate,
          quantity: 1,
        },
      ]);

      if (error) {
        alert("Error adding planned meal");
        setAddingMeal(false);
        return;
      }
    }

    setSelectedRecipeId("");
    setAddingMeal(false);
    await loadPage();
  };

  const handleQuantityChange = async (mealId: string, newQuantity: number) => {
    if (newQuantity < 1) return;

    setUpdatingMealId(mealId);

    const { error } = await supabase
      .from("meal_plans")
      .update({ quantity: newQuantity })
      .eq("id", mealId);

    if (error) {
      alert("Error updating quantity");
      setUpdatingMealId(null);
      return;
    }

    setPlannedMeals((prev) =>
      prev.map((meal) =>
        meal.id === mealId ? { ...meal, quantity: newQuantity } : meal
      )
    );

    setUpdatingMealId(null);
  };

  const handleRemoveMeal = async (mealId: string) => {
    setRemovingMealId(mealId);

    const { error } = await supabase.from("meal_plans").delete().eq("id", mealId);

    if (error) {
      alert("Error removing planned meal");
      setRemovingMealId(null);
      return;
    }

    setPlannedMeals((prev) => prev.filter((meal) => meal.id !== mealId));
    setRemovingMealId(null);
  };

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <PageHeader title="Meal Planner" showClientNav />
<div className="mb-6">
  <Link
    href="/client/shopping-list"
    className={`${styles.card} bg-[#F2F2F2] transition hover:bg-[#eaeaea] block`}
  >
    <p className="text-sm text-[#2B2B2B]">Shopping List</p>
    <p className="mt-1 text-lg font-semibold text-[#111111]">
      View collated ingredients from your meal plan
    </p>
    <p className="mt-2 text-sm text-[#2B2B2B]">
      Generate a combined list from your planned meals
    </p>
  </Link>
</div>
        {loading ? (
          <p className={styles.body}>Loading planner...</p>
        ) : !client ? (
          <p className={styles.body}>Client not found.</p>
        ) : (
          <div className="space-y-6">
            <div className={`${styles.card} bg-[#F2F2F2]`}>
              <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                <div>
                  <h2 className={styles.subheading}>Planned Meals</h2>
                  <p className="mt-1 text-sm text-[#2B2B2B]">
                    Total planned calories: {plannedCalories} kcal
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-[#111111]">
                    Planned date
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className={styles.input}
                  />
                </div>
              </div>
            </div>

            <div className={styles.card}>
              <h2 className={styles.subheading}>Add Planned Meal</h2>

              <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                <div>
                  <label className="text-sm font-medium text-[#111111]">
                    Choose recipe
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
                  onClick={handleAddMeal}
                  disabled={addingMeal}
                  className={styles.buttonPrimary}
                >
                  {addingMeal ? "Adding..." : "Add to Plan"}
                </button>
              </div>
            </div>

            <div className={styles.card}>
              <h2 className={styles.subheading}>Meals Planned For {selectedDate}</h2>

              <div className="mt-4 space-y-2">
                {plannedMeals.length === 0 ? (
                  <p className={styles.body}>No meals planned for this date yet.</p>
                ) : (
                  plannedMeals.map((meal) => {
                    const quantity = meal.quantity ?? 1;
                    const caloriesPerMeal = meal.recipes?.calories ?? 0;
                    const totalMealCalories = caloriesPerMeal * quantity;

                    return (
                      <div
                        key={meal.id}
                        className="flex flex-col gap-3 rounded-lg border border-slate-200 px-3 py-3 md:flex-row md:items-center md:justify-between"
                      >
                        <div>
                          <p className="font-medium text-[#111111]">
                            {meal.recipes?.name || "Unnamed meal"}
                          </p>
                          <p className="text-sm text-[#2B2B2B]">
                            {caloriesPerMeal} kcal each
                          </p>
                          {meal.recipes?.description && (
                            <p className="text-sm text-[#2B2B2B]">
                              {meal.recipes.description}
                            </p>
                          )}
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

                          <span className="min-w-[90px] text-center text-sm font-medium text-[#111111]">
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

                          <span className="min-w-[100px] text-right text-sm font-medium text-[#111111]">
                            {totalMealCalories} kcal
                          </span>

                          <button
                            type="button"
                            onClick={() => handleRemoveMeal(meal.id)}
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
          </div>
        )}
      </div>
    </main>
  );
}