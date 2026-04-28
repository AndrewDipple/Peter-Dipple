"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";
import Link from "next/link";

type PageProps = {
  params: Promise<{ id: string }>;
};

type Recipe = {
  id: string;
  name: string;
  description: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  estimated_cooking_time_minutes: number | null;
  image_url: string | null;
  instructions: string | null;
  is_vegetarian: boolean | null;
  is_vegan: boolean | null;
  is_dairy_free: boolean | null;
  is_gluten_free: boolean | null;
};

type IngredientRow = {
  id?: string;
  ingredient_name: string;
  quantity: string;
  unit: string;
  note: string;
};

export default function EditRecipePage({ params }: PageProps) {
  const [recipeId, setRecipeId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [calories, setCalories] = useState("");
  const [proteinG, setProteinG] = useState("");
  const [carbsG, setCarbsG] = useState("");
  const [fatG, setFatG] = useState("");
  const [cookingTime, setCookingTime] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [instructions, setInstructions] = useState("");

  const [isVegetarian, setIsVegetarian] = useState(false);
  const [isVegan, setIsVegan] = useState(false);
  const [isDairyFree, setIsDairyFree] = useState(false);
  const [isGlutenFree, setIsGlutenFree] = useState(false);

  const [ingredients, setIngredients] = useState<IngredientRow[]>([
    { ingredient_name: "", quantity: "", unit: "", note: "" },
  ]);
  const [originalIngredientIds, setOriginalIngredientIds] = useState<string[]>([]);

  const hasRealIngredients = useMemo(() => {
    return ingredients.some(
      (row) => row.ingredient_name.trim() !== "" || row.quantity.trim() !== ""
    );
  }, [ingredients]);

  useEffect(() => {
    const loadPage = async () => {
      setLoading(true);

      const resolvedParams = await params;
      const id = resolvedParams.id;
      setRecipeId(id);

      const { data: recipeData, error: recipeError } = await supabase
        .from("recipes")
        .select("*")
        .eq("id", id)
        .single();

      if (recipeError || !recipeData) {
        setLoading(false);
        return;
      }

      const recipe = recipeData as Recipe;

      setName(recipe.name ?? "");
      setDescription(recipe.description ?? "");
      setCalories(recipe.calories !== null && recipe.calories !== undefined ? String(recipe.calories) : "");
      setProteinG(recipe.protein_g !== null && recipe.protein_g !== undefined ? String(recipe.protein_g) : "");
      setCarbsG(recipe.carbs_g !== null && recipe.carbs_g !== undefined ? String(recipe.carbs_g) : "");
      setFatG(recipe.fat_g !== null && recipe.fat_g !== undefined ? String(recipe.fat_g) : "");
      setCookingTime(
        recipe.estimated_cooking_time_minutes !== null &&
          recipe.estimated_cooking_time_minutes !== undefined
          ? String(recipe.estimated_cooking_time_minutes)
          : ""
      );
      setImageUrl(recipe.image_url ?? "");
      setInstructions(recipe.instructions ?? "");
      setIsVegetarian(Boolean(recipe.is_vegetarian));
      setIsVegan(Boolean(recipe.is_vegan));
      setIsDairyFree(Boolean(recipe.is_dairy_free));
      setIsGlutenFree(Boolean(recipe.is_gluten_free));

      const { data: ingredientData, error: ingredientError } = await supabase
        .from("recipe_ingredients")
        .select("*")
        .eq("recipe_id", id)
        .order("created_at", { ascending: true });

      if (!ingredientError && ingredientData && ingredientData.length > 0) {
        setIngredients(
          ingredientData.map((row: any) => ({
            id: row.id,
            ingredient_name: row.ingredient_name ?? "",
            quantity:
              row.quantity !== null && row.quantity !== undefined
                ? String(row.quantity)
                : "",
            unit: row.unit ?? "",
            note: row.note ?? "",
          }))
        );
        setOriginalIngredientIds(ingredientData.map((row: any) => row.id));
      } else {
        setIngredients([{ ingredient_name: "", quantity: "", unit: "", note: "" }]);
        setOriginalIngredientIds([]);
      }

      setLoading(false);
    };

    loadPage();
  }, [params]);

  const addIngredientRow = () => {
    setIngredients((prev) => [
      ...prev,
      { ingredient_name: "", quantity: "", unit: "", note: "" },
    ]);
  };

  const updateIngredientRow = (
    index: number,
    field: keyof IngredientRow,
    value: string
  ) => {
    setIngredients((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeIngredientRow = (index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!recipeId) return;
    if (!name.trim()) {
      alert("Please enter a recipe name");
      return;
    }

    setSaving(true);

    const { error: recipeError } = await supabase
      .from("recipes")
      .update({
        name: name.trim(),
        description: description.trim() || null,
        calories: calories.trim() ? Number(calories) : null,
        protein_g: proteinG.trim() ? Number(proteinG) : null,
        carbs_g: carbsG.trim() ? Number(carbsG) : null,
        fat_g: fatG.trim() ? Number(fatG) : null,
        estimated_cooking_time_minutes: cookingTime.trim()
          ? Number(cookingTime)
          : null,
        image_url: imageUrl.trim() || null,
        instructions: instructions.trim() || null,
        is_vegetarian: isVegetarian,
        is_vegan: isVegan,
        is_dairy_free: isDairyFree,
        is_gluten_free: isGlutenFree,
      })
      .eq("id", recipeId);

    if (recipeError) {
      console.error(recipeError);
      alert("Error updating recipe");
      setSaving(false);
      return;
    }

    const cleanedRows = ingredients.filter(
      (row) => row.ingredient_name.trim() !== "" && row.quantity.trim() !== ""
    );

    const existingRows = cleanedRows.filter((row) => row.id);
    const newRows = cleanedRows.filter((row) => !row.id);
    const currentIds = existingRows
      .map((row) => row.id)
      .filter(Boolean) as string[];

    const idsToDelete = originalIngredientIds.filter(
      (id) => !currentIds.includes(id)
    );

    for (const row of existingRows) {
      const { error } = await supabase
        .from("recipe_ingredients")
        .update({
          ingredient_name: row.ingredient_name.trim(),
          quantity: Number(row.quantity),
          unit: row.unit.trim() || null,
          note: row.note.trim() || null,
        })
        .eq("id", row.id!);

      if (error) {
        alert("Error updating ingredient rows");
        setSaving(false);
        return;
      }
    }

    if (newRows.length > 0) {
      const insertRows = newRows.map((row) => ({
        recipe_id: recipeId,
        ingredient_name: row.ingredient_name.trim(),
        quantity: Number(row.quantity),
        unit: row.unit.trim() || null,
        note: row.note.trim() || null,
      }));

      const { error } = await supabase
        .from("recipe_ingredients")
        .insert(insertRows);

      if (error) {
        alert("Error creating new ingredient rows");
        setSaving(false);
        return;
      }
    }

    if (idsToDelete.length > 0) {
      const { error } = await supabase
        .from("recipe_ingredients")
        .delete()
        .in("id", idsToDelete);

      if (error) {
        alert("Error deleting removed ingredient rows");
        setSaving(false);
        return;
      }
    }

    alert("Recipe updated!");
    window.location.href = "/trainer/recipes";
  };

return (
    <>
      <div className="mb-6 flex items-center gap-4">
        <Link href="/trainer/recipes" className={styles.buttonSecondary}>
          ← Back
        </Link>
        <h1 className={styles.display}>Edit Recipe</h1>
      </div>

      {loading ? (
        <p className={styles.body}>Loading recipe...</p>
      ) : (
        <div className="space-y-6">
          <div className={styles.card}>
            <h2 className={styles.h2}>Recipe Details</h2>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-ink">
                  Recipe Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={styles.input}
                  placeholder="Recipe name"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-ink">
                  Calories
                </label>
                <input
                  type="number"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  className={styles.input}
                  placeholder="Calories"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-ink">
                  Protein (g)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={proteinG}
                  onChange={(e) => setProteinG(e.target.value)}
                  className={styles.input}
                  placeholder="Protein"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-ink">
                  Carbs (g)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={carbsG}
                  onChange={(e) => setCarbsG(e.target.value)}
                  className={styles.input}
                  placeholder="Carbs"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-ink">
                  Fat (g)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={fatG}
                  onChange={(e) => setFatG(e.target.value)}
                  className={styles.input}
                  placeholder="Fat"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-ink">
                  Est. Cooking Time (minutes)
                </label>
                <input
                  type="number"
                  value={cookingTime}
                  onChange={(e) => setCookingTime(e.target.value)}
                  className={styles.input}
                  placeholder="e.g. 20"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-medium text-ink">
                  Description
                </label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={styles.input}
                  placeholder="Short description"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-medium text-ink">
                  Image URL
                </label>
                <input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className={styles.input}
                  placeholder="https://..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-medium text-ink">
                  Tags
                </label>
                <div className="mt-2 grid gap-3 md:grid-cols-4">
                  <label className="flex items-center gap-2 rounded-xl border border-border-subtle p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={isVegetarian}
                      onChange={(e) => setIsVegetarian(e.target.checked)}
                    />
                    Vegetarian
                  </label>

                  <label className="flex items-center gap-2 rounded-xl border border-border-subtle p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={isVegan}
                      onChange={(e) => setIsVegan(e.target.checked)}
                    />
                    Vegan
                  </label>

                  <label className="flex items-center gap-2 rounded-xl border border-border-subtle p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={isDairyFree}
                      onChange={(e) => setIsDairyFree(e.target.checked)}
                    />
                    Dairy free
                  </label>

                  <label className="flex items-center gap-2 rounded-xl border border-border-subtle p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={isGlutenFree}
                      onChange={(e) => setIsGlutenFree(e.target.checked)}
                    />
                    Gluten free
                  </label>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-medium text-ink">
                  Instructions
                </label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className={`${styles.input} min-h-35`}
                  placeholder="Cooking instructions"
                />
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <div className="flex items-center justify-between">
              <h2 className={styles.h2}>Ingredients</h2>
              <button
                type="button"
                onClick={addIngredientRow}
                className={styles.buttonSecondary}
              >
                Add Ingredient
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {ingredients.map((row, index) => (
                <div
                  key={row.id ?? `new-${index}`}
                  className="grid gap-3 rounded-xl border border-border-subtle p-4 md:grid-cols-12"
                >
                  <div className="md:col-span-3">
                    <label className="text-sm font-medium text-ink">
                      Ingredient
                    </label>
                    <input
                      value={row.ingredient_name}
                      onChange={(e) =>
                        updateIngredientRow(
                          index,
                          "ingredient_name",
                          e.target.value
                        )
                      }
                      className={styles.input}
                      placeholder="e.g. Bagel"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-ink">
                      Quantity
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={row.quantity}
                      onChange={(e) =>
                        updateIngredientRow(index, "quantity", e.target.value)
                      }
                      className={styles.input}
                      placeholder="2"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-ink">
                      Unit
                    </label>
                    <input
                      value={row.unit}
                      onChange={(e) =>
                        updateIngredientRow(index, "unit", e.target.value)
                      }
                      className={styles.input}
                      placeholder="item / g / ml"
                    />
                  </div>

                  <div className="md:col-span-4">
                    <label className="text-sm font-medium text-ink">
                      Note
                    </label>
                    <input
                      value={row.note}
                      onChange={(e) =>
                        updateIngredientRow(index, "note", e.target.value)
                      }
                      className={styles.input}
                      placeholder="e.g. Warburton bagel thins"
                    />
                  </div>

                  <div className="md:col-span-1 flex items-end">
                    <button
                      type="button"
                      onClick={() => removeIngredientRow(index)}
                      className="w-full rounded-xl border border-red-300 px-3 py-2 text-red-600 hover:bg-red-50"
                    >
                      X
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {!hasRealIngredients && (
              <p className="mt-3 text-sm text-ink-muted">
                No structured ingredients yet. Add rows above to migrate this recipe.
              </p>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className={`${styles.buttonPrimary} w-full py-3 disabled:opacity-50`}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}
    </>
  );
}