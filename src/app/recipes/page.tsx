"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";
import { isStaff } from "@/lib/roles";

type Recipe = {
  id: string;
  name: string;
  description: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  estimated_cooking_time_minutes: number | null;
  is_vegetarian: boolean | null;
  is_vegan: boolean | null;
  is_dairy_free: boolean | null;
  is_gluten_free: boolean | null;
};

function getRecipeTags(recipe: Recipe) {
  const tags: string[] = [];
  if (recipe.is_vegetarian) tags.push("Vegetarian");
  if (recipe.is_vegan) tags.push("Vegan");
  if (recipe.is_dairy_free) tags.push("Dairy free");
  if (recipe.is_gluten_free) tags.push("Gluten free");
  return tags;
}

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [showVegetarian, setShowVegetarian] = useState(false);
  const [showVegan, setShowVegan] = useState(false);
  const [showDairyFree, setShowDairyFree] = useState(false);
  const [showGlutenFree, setShowGlutenFree] = useState(false);

  useEffect(() => {
    const load = async () => {
      // Fetch recipes and the user's role in parallel.
      const [recipesRes, userRes] = await Promise.all([
        supabase
          .from("recipes")
          .select(
            "id, name, description, calories, protein_g, carbs_g, fat_g, estimated_cooking_time_minutes, is_vegetarian, is_vegan, is_dairy_free, is_gluten_free"
          )
          .order("created_at", { ascending: false }),
        supabase.auth.getUser(),
      ]);

      if (!recipesRes.error && recipesRes.data) {
        setRecipes(recipesRes.data);
      }

      const user = userRes.data.user;
      if (user) {
        const { data: profileRow } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        setCanEdit(isStaff(profileRow?.role));
      }

      setLoading(false);
    };

    load();
  }, []);

  const filteredRecipes = useMemo(() => {
    let filtered = recipes;

    filtered = filtered.filter((recipe) => {
      if (showVegetarian && !recipe.is_vegetarian) return false;
      if (showVegan && !recipe.is_vegan) return false;
      if (showDairyFree && !recipe.is_dairy_free) return false;
      if (showGlutenFree && !recipe.is_gluten_free) return false;
      return true;
    });

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((recipe) => {
        const name = recipe.name?.toLowerCase() || "";
        const description = recipe.description?.toLowerCase() || "";
        const tags = getRecipeTags(recipe).join(" ").toLowerCase();
        return name.includes(query) || description.includes(query) || tags.includes(query);
      });
    }

    return filtered;
  }, [recipes, searchQuery, showVegetarian, showVegan, showDairyFree, showGlutenFree]);

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className={styles.display}>Recipe Menu</h1>
        {canEdit && (
          <Link href="/recipes/new" className={styles.buttonPrimary}>
            Add Recipe
          </Link>
        )}
      </div>

      {/* Search Box */}
      <div className="mb-6">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search recipes by name, description, or tags..."
          className={styles.input}
        />
      </div>

      <div className={styles.card}>
        <div>
          <h2 className={styles.h2}>Filter Recipes</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Browse recipes by dietary requirements.
          </p>
        </div>

<div className="mt-4 grid gap-3 md:grid-cols-4">
  <label
    className={`flex cursor-pointer items-center justify-center rounded-xl border p-3 text-sm transition select-none ${
      showVegetarian
        ? "border-emerald bg-emerald text-white font-semibold"
        : "border-border-subtle text-ink hover:border-emerald/50"
    }`}
  >
    <input
      type="checkbox"
      checked={showVegetarian}
      onChange={(e) => setShowVegetarian(e.target.checked)}
      className="sr-only"
    />
    Vegetarian
  </label>

  <label
    className={`flex cursor-pointer items-center justify-center rounded-xl border p-3 text-sm transition select-none ${
      showVegan
        ? "border-emerald bg-emerald text-white font-semibold"
        : "border-border-subtle text-ink hover:border-emerald/50"
    }`}
  >
    <input
      type="checkbox"
      checked={showVegan}
      onChange={(e) => setShowVegan(e.target.checked)}
      className="sr-only"
    />
    Vegan
  </label>

  <label
    className={`flex cursor-pointer items-center justify-center rounded-xl border p-3 text-sm transition select-none ${
      showDairyFree
        ? "border-emerald bg-emerald text-white font-semibold"
        : "border-border-subtle text-ink hover:border-emerald/50"
    }`}
  >
    <input
      type="checkbox"
      checked={showDairyFree}
      onChange={(e) => setShowDairyFree(e.target.checked)}
      className="sr-only"
    />
    Dairy free
  </label>

  <label
    className={`flex cursor-pointer items-center justify-center rounded-xl border p-3 text-sm transition select-none ${
      showGlutenFree
        ? "border-emerald bg-emerald text-white font-semibold"
        : "border-border-subtle text-ink hover:border-emerald/50"
    }`}
  >
    <input
      type="checkbox"
      checked={showGlutenFree}
      onChange={(e) => setShowGlutenFree(e.target.checked)}
      className="sr-only"
    />
    Gluten free
  </label>
</div>
      </div>

<div className="mt-6 flex flex-col gap-4">
        {loading ? (
          <p className={styles.body}>Loading recipes...</p>
        ) : filteredRecipes.length === 0 ? (
          <p className={styles.body}>No recipes match those filters.</p>
        ) : (
          filteredRecipes.map((recipe) => {
            const tags = getRecipeTags(recipe);

            return (
              <Link key={recipe.id} href={`/recipes/${recipe.id}`}>
                <div className="cursor-pointer rounded-xl border border-border-subtle p-4 transition hover:bg-surface-sunken">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h2 className="font-semibold text-emerald">{recipe.name}</h2>
                      <p className="mt-1 text-sm text-ink-muted">
                        {recipe.description || "No description"}
                      </p>

                      <div className="mt-7 flex flex-wrap gap-2">
                        {tags.length > 0 ? (
                          tags.map((tag) => (
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
                    </div>

<div className="text-left md:text-right">
  
    <p className="mt-1 text-base font-semibold text-ink-muted">
    Time:{" "}
    {recipe.estimated_cooking_time_minutes
      ? `${recipe.estimated_cooking_time_minutes} min`
      : "-"}
  </p>
  <p className="mt-1 text-base font-semibold text-ink-muted">
    Calories: {recipe.calories ?? "-"}
  </p>

  <p className="mt-2 text-xs text-ink-muted">
    Protein: {recipe.protein_g ?? "-"}g
  </p>
  <p className="mt-1 text-xs text-ink-muted">
    Carbs: {recipe.carbs_g ?? "-"}g
  </p>
  <p className="mt-1 text-xs text-ink-muted">
    Fat: {recipe.fat_g ?? "-"}g
  </p>
</div>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </>
  );
}