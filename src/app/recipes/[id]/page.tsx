"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";
import { isStaff } from "@/lib/roles";
import { todayStr } from "@/lib/dates";
import { awardBondXp } from "@/lib/companions";

type Recipe = {
  id: string;
  name: string;
  description: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  estimated_cooking_time_minutes: number | null;
  instructions: string | null;
  image_url: string | null;
  is_vegetarian: boolean | null;
  is_vegan: boolean | null;
  is_dairy_free: boolean | null;
  is_gluten_free: boolean | null;
};

type RecipeIngredient = {
  id: string;
  recipe_id: string;
  ingredient_name: string;
  quantity: number;
  unit: string | null;
  note: string | null;
};

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

function getRecipeTags(recipe: Recipe) {
  const tags = [];

  if (recipe.is_vegetarian) tags.push("Vegetarian");
  if (recipe.is_vegan) tags.push("Vegan");
  if (recipe.is_dairy_free) tags.push("Dairy free");
  if (recipe.is_gluten_free) tags.push("Gluten free");

  return tags;
}

export default function RecipeDetailPage({ params }: PageProps) {
  const [recipeId, setRecipeId] = useState("");
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);

  const [clientId, setClientId] = useState<string | null>(null);
const [addingToPlan, setAddingToPlan] = useState(false);
const [markingEaten, setMarkingEaten] = useState(false);
const [toast, setToast] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    const loadRecipe = async () => {
      const resolvedParams = await params;
      const id = resolvedParams.id;
      setRecipeId(id);

      const [recipeRes, ingredientsRes, userRes] = await Promise.all([
        supabase.from("recipes").select("*").eq("id", id).single(),
        supabase
          .from("recipe_ingredients")
          .select("*")
          .eq("recipe_id", id)
          .order("created_at", { ascending: true }),
        supabase.auth.getUser(),
      ]);

      if (!recipeRes.error && recipeRes.data) {
        setRecipe(recipeRes.data);
      } else {
        setRecipe(null);
      }

      if (!ingredientsRes.error && ingredientsRes.data) {
        setIngredients(ingredientsRes.data);
      } else {
        setIngredients([]);
      }

const user = userRes.data.user;
if (user) {
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profileRow?.role;
  setCanEdit(isStaff(role));

  // Look up client row for clients only — trainers don't have one.
  if (role === "client") {
    const { data: clientRow } = await supabase
      .from("clients")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (clientRow) setClientId(clientRow.id);
  }
}


      setLoading(false);
    };

    loadRecipe();
  }, [params]);

  const recipeTags = recipe ? getRecipeTags(recipe) : [];

const flashToast = (text: string, type: "success" | "error" = "success") => {
  setToast({ text, type });
  setTimeout(() => setToast(null), 3000);
};

const handleAddToMealPlan = async () => {
  if (!clientId || !recipeId) return;
  setAddingToPlan(true);

  const { error } = await supabase.from("meal_plans").insert([
    {
      client_id: clientId,
      recipe_id: recipeId,
      planned_date: todayStr(),
      quantity: 1,
    },
  ]);

  setAddingToPlan(false);

  if (error) {
    flashToast("Could not add to meal plan", "error");
    return;
  }

  flashToast("Added to today's meal plan");
};

const handleMarkAsEaten = async () => {
  if (!clientId || !recipeId) return;
  setMarkingEaten(true);

  const { error } = await supabase.from("meal_logs").insert([
    {
      client_id: clientId,
      recipe_id: recipeId,
      log_date: todayStr(),
      completed: true,
      quantity: 1,
    },
  ]);

  if (error) {
    setMarkingEaten(false);
    flashToast("Could not mark as eaten", "error");
    return;
  }

  // Same XP grant as the nutrition page's off-plan log.
  await awardBondXp(clientId, 10, "logged_off_plan_meal", "Logged a recipe as eaten");

  setMarkingEaten(false);
  flashToast("Marked as eaten");
};

  return (
    <>
      {toast && (
  <div
    className={`fixed top-4 left-1/2 z-[100] -translate-x-1/2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
      toast.type === "success"
        ? "bg-emerald text-white"
        : "bg-red-600 text-white"
    }`}
  >
    {toast.text}
  </div>
)}
      
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/recipes" className={styles.buttonSecondary}>
            ← Back
          </Link>
          <h1 className={styles.display}>Recipe Detail</h1>
        </div>
        {canEdit && recipeId && (
          <Link
            href={`/recipes/${recipeId}/edit`}
            className={styles.buttonPrimary}
          >
            Edit Recipe
          </Link>
        )}
      </div>

      {loading ? (
        <p className={styles.body}>Loading recipe...</p>
      ) : !recipe ? (
        <p className={styles.body}>Recipe not found.</p>
      ) : (
        <div className="space-y-6">
          {recipe.image_url && (
            <img
              src={recipe.image_url}
              alt={recipe.name}
              className="w-full rounded-xl border border-border-subtle object-cover"
            />
          )}

          <div className={styles.card}>
            <h2 className="text-xl font-semibold text-ink">
              {recipe.name}
            </h2>

            <p className="mt-1 text-ink-muted">
              {recipe.description || "No description"}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {recipe.estimated_cooking_time_minutes !== null &&
                recipe.estimated_cooking_time_minutes !== undefined && (
                  <span className="rounded-full bg-surface-sunken px-3 py-1 text-xs font-medium text-ink">
                    {recipe.estimated_cooking_time_minutes} min
                  </span>
                )}

              {recipeTags.length > 0 ? (
                recipeTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-emerald px-3 py-1 text-xs font-medium text-ink"
                  >
                    {tag}
                  </span>
                ))
              ) : (
                <span className="rounded-full bg-surface-sunken px-3 py-1 text-xs font-medium text-ink-muted">
                  No tags
                </span>
              )}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-xl bg-surface-sunken p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                  Calories
                </p>
                <p className="mt-1 text-lg font-semibold text-ink">
                  {recipe.calories ?? "-"}
                </p>
              </div>

              <div className="rounded-xl bg-surface-sunken p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                  Protein
                </p>
                <p className="mt-1 text-lg font-semibold text-ink">
                  {recipe.protein_g ?? "-"}
                </p>
              </div>

              <div className="rounded-xl bg-surface-sunken p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                  Carbs
                </p>
                <p className="mt-1 text-lg font-semibold text-ink">
                  {recipe.carbs_g ?? "-"}
                </p>
              </div>

              <div className="rounded-xl bg-surface-sunken p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                  Fat
                </p>
                <p className="mt-1 text-lg font-semibold text-ink">
                  {recipe.fat_g ?? "-"}
                </p>
              </div>
            </div>

            <p className="mt-4 rounded-xl bg-surface-sunken p-3 text-xs text-ink-muted">
              Calories and macros are estimates and may vary depending on
              brands, portion sizes, and substitutions.
            </p>
          </div>

          <div className={styles.card}>
            <h3 className="font-semibold text-ink">Ingredients</h3>

            <div className="mt-4 space-y-2">
              {ingredients.length === 0 ? (
                <p className={styles.body}>No structured ingredients added yet.</p>
              ) : (
                ingredients.map((ingredient) => (
                  <div
                    key={ingredient.id}
                    className="rounded-xl border border-border-subtle px-4 py-3"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-medium text-ink">
                          {ingredient.ingredient_name}
                        </p>

                        {ingredient.note && (
                          <p className="text-sm text-ink-muted">
                            {ingredient.note}
                          </p>
                        )}
                      </div>

                      <p className="text-sm font-medium text-ink">
                        {Number.isInteger(ingredient.quantity)
                          ? ingredient.quantity
                          : Number(ingredient.quantity).toFixed(1)}{" "}
                        {ingredient.unit ?? ""}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className={styles.card}>
            <h3 className="font-semibold text-ink">Instructions</h3>
            <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-surface-sunken p-4 text-sm text-ink">
              {recipe.instructions || "No instructions"}
            </pre>
          </div>
          {/* Client-only action buttons */}
{clientId && (
  <div className="flex flex-col gap-3 sm:flex-row">
    <button
      type="button"
      onClick={handleAddToMealPlan}
      disabled={addingToPlan || markingEaten}
      className={`${styles.buttonSecondary} flex-1 disabled:opacity-50`}
    >
      {addingToPlan ? "Adding..." : "Add to today's meal plan"}
    </button>

    <button
      type="button"
      onClick={handleMarkAsEaten}
      disabled={addingToPlan || markingEaten}
      className={`${styles.buttonPrimary} flex-1 disabled:opacity-50`}
    >
      {markingEaten ? "Saving..." : "Mark as eaten"}
    </button>
  </div>
)}
        </div>
      )}
    </>
  );
}