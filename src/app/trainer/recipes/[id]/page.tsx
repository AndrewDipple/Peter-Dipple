"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";

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

export default function TrainerRecipeDetailPage({ params }: PageProps) {
  const [recipeId, setRecipeId] = useState("");
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRecipe = async () => {
      const resolvedParams = await params;
      const id = resolvedParams.id;
      setRecipeId(id);

      const { data: recipeData, error: recipeError } = await supabase
        .from("recipes")
        .select("*")
        .eq("id", id)
        .single();

      if (!recipeError && recipeData) {
        setRecipe(recipeData);
      } else {
        setRecipe(null);
      }

      const { data: ingredientData, error: ingredientError } = await supabase
        .from("recipe_ingredients")
        .select("*")
        .eq("recipe_id", id)
        .order("created_at", { ascending: true });

      if (!ingredientError && ingredientData) {
        setIngredients(ingredientData);
      } else {
        setIngredients([]);
      }

      setLoading(false);
    };

    loadRecipe();
  }, [params]);

  const recipeTags = recipe ? getRecipeTags(recipe) : [];

return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/trainer/recipes" className={styles.buttonSecondary}>
            ← Back
          </Link>
          <h1 className={styles.display}>Recipe Detail</h1>
        </div>
        {recipeId && (
          <Link
            href={`/trainer/recipes/${recipeId}/edit`}
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
                    className="rounded-full border border-gold px-3 py-1 text-xs font-medium text-ink"
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
        </div>
      )}
    </>
  );
}