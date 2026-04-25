"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/PageHeader";
import { styles } from "@/lib/design";

type IngredientRow = {
  ingredient_name: string;
  quantity: string;
  unit: string;
  note: string;
};



export default function NewRecipePage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [calories, setCalories] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [instructions, setInstructions] = useState("");
  const [saving, setSaving] = useState(false);

  const [ingredients, setIngredients] = useState<IngredientRow[]>([
    { ingredient_name: "", quantity: "", unit: "", note: "" },
  ]);

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
    if (!name.trim()) {
      alert("Please enter a recipe name");
      return;
    }

    setSaving(true);

    const { data: recipeData, error: recipeError } = await supabase
      .from("recipes")
      .insert([
        {
          name: name.trim(),
          description: description.trim() || null,
          calories: calories.trim() ? Number(calories) : null,
          image_url: imageUrl.trim() || null,
          instructions: instructions.trim() || null,
        },
      ])
      .select()
      .single();

    if (recipeError || !recipeData) {
      alert("Error creating recipe");
      setSaving(false);
      return;
    }

    const ingredientRows = ingredients
      .filter(
        (row) =>
          row.ingredient_name.trim() !== "" && row.quantity.trim() !== ""
      )
      .map((row) => ({
        recipe_id: recipeData.id,
        ingredient_name: row.ingredient_name.trim(),
        quantity: Number(row.quantity),
        unit: row.unit.trim() || null,
        note: row.note.trim() || null,
      }));

    if (ingredientRows.length > 0) {
      const { error: ingredientError } = await supabase
        .from("recipe_ingredients")
        .insert(ingredientRows);

      if (ingredientError) {
        alert("Recipe created, but ingredients failed to save");
        setSaving(false);
        return;
      }
    }

    alert("Recipe created!");
    window.location.href = "/trainer/recipes";
  };

  return (
    <main className={styles.page}>
      <div className="mx-auto max-w-6xl rounded-2xl bg-white p-6 shadow">
        <PageHeader
          title="New Recipe"
          backHref="/trainer/recipes"
          showTrainerNav
        />

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
                  key={index}
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
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className={`${styles.buttonPrimary} w-full py-3 disabled:opacity-50`}
          >
            {saving ? "Saving..." : "Save Recipe"}
          </button>
        </div>
      </div>
    </main>
  );
}