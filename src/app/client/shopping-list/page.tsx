"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";

type Client = {
  id: string;
  full_name: string;
  profile_id: string | null;
};

type MealPlan = {
  id: string;
  client_id: string;
  recipe_id: string;
  planned_date: string;
  quantity: number;
  recipes: {
    name: string;
  } | null;
};

type RecipeIngredient = {
  id: string;
  recipe_id: string;
  ingredient_name: string;
  quantity: number;
  unit: string | null;
  note: string | null;
};

type ShoppingListItem = {
  ingredient_name: string;
  unit: string;
  note: string;
  total_quantity: number;
};

export default function ClientShoppingListPage() {
  const [client, setClient] = useState<Client | null>(null);
  const [plannedMeals, setPlannedMeals] = useState<MealPlan[]>([]);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const defaultStart = today.toISOString().split("T")[0];
  const weekAhead = new Date(today);
  weekAhead.setDate(today.getDate() + 6);
  const defaultEnd = weekAhead.toISOString().split("T")[0];

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  const shoppingList = useMemo<ShoppingListItem[]>(() => {
    const tally = new Map<string, ShoppingListItem>();

    for (const meal of plannedMeals) {
      const mealQuantity = meal.quantity ?? 1;
      const recipeIngredients = ingredients.filter(
        (ingredient) => ingredient.recipe_id === meal.recipe_id
      );

      for (const ingredient of recipeIngredients) {
        const unit = ingredient.unit ?? "";
        const note = ingredient.note ?? "";
        const key = `${ingredient.ingredient_name.toLowerCase()}__${unit.toLowerCase()}__${note.toLowerCase()}`;

        const current = tally.get(key);
        const totalToAdd = Number(ingredient.quantity) * mealQuantity;

        if (current) {
          current.total_quantity += totalToAdd;
        } else {
          tally.set(key, {
            ingredient_name: ingredient.ingredient_name,
            unit,
            note,
            total_quantity: totalToAdd,
          });
        }
      }
    }

    return Array.from(tally.values()).sort((a, b) => {
      const byName = a.ingredient_name.localeCompare(b.ingredient_name);
      if (byName !== 0) return byName;
      return a.note.localeCompare(b.note);
    });
  }, [plannedMeals, ingredients]);

  const loadPage = async () => {
    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setClient(null);
      setPlannedMeals([]);
      setIngredients([]);
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
      setPlannedMeals([]);
      setIngredients([]);
      setLoading(false);
      return;
    }

    setClient(clientData);

    const { data: planData, error: planError } = await supabase
      .from("meal_plans")
      .select("id, client_id, recipe_id, planned_date, quantity, recipes(name)")
      .eq("client_id", clientData.id)
      .gte("planned_date", startDate)
      .lte("planned_date", endDate)
      .order("planned_date", { ascending: true });

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
              }
            : null,
        };
      });

      setPlannedMeals(normalizedPlans);

      const recipeIds = Array.from(new Set(normalizedPlans.map((meal) => meal.recipe_id)));

      if (recipeIds.length > 0) {
        const { data: ingredientData, error: ingredientError } = await supabase
          .from("recipe_ingredients")
          .select("*")
          .in("recipe_id", recipeIds);

        if (!ingredientError && ingredientData) {
          setIngredients(ingredientData);
        } else {
          setIngredients([]);
        }
      } else {
        setIngredients([]);
      }
    } else {
      setPlannedMeals([]);
      setIngredients([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadPage();
  }, [startDate, endDate]);

return (
    <>
      <h1 className={styles.display}>Shopping List</h1>

      {loading ? (
        <p className={styles.body}>Loading shopping list...</p>
      ) : !client ? (
        <p className={styles.body}>Client not found.</p>
      ) : (
        <div className="mt-6 space-y-6">
          <div className={`${styles.card} bg-surface-sunken`}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-ink">
                  Start date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={styles.input}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-ink">
                  End date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={styles.input}
                />
              </div>
            </div>

            <p className="mt-4 text-sm text-ink-muted">
              {plannedMeals.length} planned meal entries found in this range
            </p>
          </div>

          <div className={styles.card}>
            <h2 className={styles.h2}>Collated Shopping List</h2>

            <div className="mt-4 space-y-2">
              {shoppingList.length === 0 ? (
                <p className={styles.body}>No ingredients to show yet.</p>
              ) : (
                shoppingList.map((item) => (
                  <div
                    key={`${item.ingredient_name}-${item.unit}-${item.note}`}
                    className="rounded-lg border border-border-subtle px-3 py-3"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-medium text-ink">
                        {item.ingredient_name}
                      </span>
                      <span className="text-sm font-medium text-ink">
                        {Number.isInteger(item.total_quantity)
                          ? item.total_quantity
                          : item.total_quantity.toFixed(1)}{" "}
                        {item.unit}
                      </span>
                    </div>

                    {item.note && (
                      <p className="mt-1 text-sm text-ink-muted">
                        {item.note}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className={styles.card}>
            <h2 className={styles.h2}>Planned Meals in Range</h2>

            <div className="mt-4 space-y-2">
              {plannedMeals.length === 0 ? (
                <p className={styles.body}>No planned meals in this date range.</p>
              ) : (
                plannedMeals.map((meal) => (
                  <div
                    key={meal.id}
                    className="flex items-center justify-between rounded-lg border border-border-subtle px-3 py-2"
                  >
                    <div>
                      <p className="font-medium text-ink">
                        {meal.recipes?.name || "Unnamed recipe"}
                      </p>
                      <p className="text-sm text-ink-muted">{meal.planned_date}</p>
                    </div>
                    <p className="text-sm font-medium text-ink">
                      Qty: {meal.quantity}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}