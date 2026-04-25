"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/PageHeader";
import { styles } from "@/lib/design";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type Recipe = {
  id: string;
  name: string;
  description: string | null;
  calories: number | null;
  image_url: string | null;
  instructions: string | null;
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
  const [imageUrl, setImageUrl] = useState("");
  const [instructions, setInstructions] = useState("");

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
      setCalories(
        recipe.calories !== null && recipe.calories !== undefined
          ? String(recipe.calories)
          : ""
      );
      setImageUrl(recipe.image_url ?? "");
      setInstructions(recipe.instructions ?? "");

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
        image_url: imageUrl.trim() || null,
        instructions: instructions.trim() || null,
      })
      .eq("id", recipeId);

    if (recipeError) {
      alert("Error updating recipe");
      setSaving(false);
      return;
    }

    const cleanedRows = ingredients.filter(
      (row) =>
        row.ingredient_name.trim() !== "" && row.quantity.trim() !== ""
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
    <main className={styles.page}>
      <div className="mx-auto max-w-6xl rounded-2xl bg-white p-6 shadow">
        <PageHeader
          title="Edit Recipe"
          backHref="/trainer/recipes"
          showTrainerNav
        />

        {loading ? (
          <p className={styles.body}>Loading recipe...</p>
        ) : (
          <div className="space-y-6">
            <div className={styles.card}>
              <h2 className={styles.subheading}>Recipe Details</h2>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-[#111111]">
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
                  <label className="text-sm font-medium text-[#111111]">
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

                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-[#111111]">
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
                  <label className="text-sm font-medium text-[#111111]">
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
                  <label className="text-sm font-medium text-[#111111]">
                    Instructions
                  </label>
                  <textarea
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    className={`${styles.input} min-h-[140px]`}
                    placeholder="Cooking instructions"
                  />
                </div>
              </div>
            </div>

            <div className={styles.card}>
              <div className="flex items-center justify-between">
                <h2 className={styles.subheading}>Ingredients</h2>
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
                    className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-12"
                  >
                    <div className="md:col-span-3">
                      <label className="text-sm font-medium text-[#111111]">
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
                      <label className="text-sm font-medium text-[#111111]">
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
                      <label className="text-sm font-medium text-[#111111]">
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
                      <label className="text-sm font-medium text-[#111111]">
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
                <p className="mt-3 text-sm text-[#2B2B2B]">
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
      </div>
    </main>
  );
}