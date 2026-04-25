"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/PageHeader";
import { styles } from "@/lib/design";

type Recipe = {
  id: string;
  name: string;
  description: string | null;
  calories: number | null;
  instructions: string | null;
  image_url: string | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
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

useEffect(() => {
  const checkRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "trainer") {
      window.location.href = "/client/dashboard";
    }
  };

  checkRole();
}, []);

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

  return (
    <main className={styles.page}>
      <div className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow">
        <PageHeader
          title="Recipe Detail"
          backHref="/trainer/recipes"
          showTrainerNav
          rightAction={
            recipeId ? (
              <Link
                href={`/trainer/recipes/${recipeId}/edit`}
                className={styles.buttonPrimary}
              >
                Edit Recipe
              </Link>
            ) : undefined
          }
        />

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
                className="w-full rounded-xl border border-slate-200 object-cover"
              />
            )}

            <div className={styles.card}>
              <h2 className="text-xl font-semibold text-[#111111]">
                {recipe.name}
              </h2>
              <p className="mt-1 text-[#2B2B2B]">
                {recipe.description || "No description"}
              </p>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <div className="rounded-xl bg-[#F2F2F2] p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-[#2B2B2B]">
                    Calories
                  </p>
                  <p className="mt-1 text-lg font-semibold text-[#111111]">
                    {recipe.calories ?? "-"}
                  </p>
                </div>

                <div className="rounded-xl bg-[#F2F2F2] p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-[#2B2B2B]">
                    Protein
                  </p>
                  <p className="mt-1 text-lg font-semibold text-[#111111]">
                    {recipe.protein_g ?? "-"}
                  </p>
                </div>

                <div className="rounded-xl bg-[#F2F2F2] p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-[#2B2B2B]">
                    Carbs
                  </p>
                  <p className="mt-1 text-lg font-semibold text-[#111111]">
                    {recipe.carbs_g ?? "-"}
                  </p>
                </div>

                <div className="rounded-xl bg-[#F2F2F2] p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-[#2B2B2B]">
                    Fat
                  </p>
                  <p className="mt-1 text-lg font-semibold text-[#111111]">
                    {recipe.fat_g ?? "-"}
                  </p>
                </div>
              </div>
            </div>

            <div className={styles.card}>
              <h3 className="font-semibold text-[#111111]">Ingredients</h3>

              <div className="mt-4 space-y-2">
                {ingredients.length === 0 ? (
                  <p className={styles.body}>No structured ingredients added yet.</p>
                ) : (
                  ingredients.map((ingredient) => (
                    <div
                      key={ingredient.id}
                      className="rounded-xl border border-slate-200 px-4 py-3"
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-medium text-[#111111]">
                            {ingredient.ingredient_name}
                          </p>
                          {ingredient.note && (
                            <p className="text-sm text-[#2B2B2B]">
                              {ingredient.note}
                            </p>
                          )}
                        </div>

                        <p className="text-sm font-medium text-[#111111]">
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
              <h3 className="font-semibold text-[#111111]">Instructions</h3>
              <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-[#F2F2F2] p-4 text-sm text-[#111111]">
                {recipe.instructions || "No instructions"}
              </pre>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}