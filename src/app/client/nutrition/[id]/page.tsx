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
  ingredients: string | null;
  instructions: string | null;
  image_url: string | null;
};

type Client = {
  id: string;
  profile_id: string | null;
};

type MealLog = {
  id: string;
  completed: boolean;
  quantity: number | null;
};

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default function ClientRecipeDetailPage({ params }: PageProps) {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [mealLog, setMealLog] = useState<MealLog | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    const loadRecipe = async () => {
      const resolvedParams = await params;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: clientData } = await supabase
        .from("clients")
        .select("id, profile_id")
        .eq("profile_id", user.id)
        .single();

      if (clientData) {
        setClient(clientData);

        const { data: existingLog } = await supabase
          .from("meal_logs")
          .select("*")
          .eq("client_id", clientData.id)
          .eq("recipe_id", resolvedParams.id)
          .eq("log_date", today)
          .maybeSingle();

        if (existingLog) {
          setMealLog(existingLog);
          setQuantity(String(existingLog.quantity ?? 1));
        }
      }

      const { data, error } = await supabase
        .from("recipes")
        .select("*")
        .eq("id", resolvedParams.id)
        .single();

      if (!error && data) {
        setRecipe(data);
      }

      setLoading(false);
    };

    loadRecipe();
  }, [params, today]);

  const handleSaveMeal = async () => {
    if (!client || !recipe) return;

    setSaving(true);

    const parsedQuantity =
      quantity.trim() === "" ? 1 : Math.max(1, Number(quantity));

    if (mealLog) {
      const { data, error } = await supabase
        .from("meal_logs")
        .update({
          completed: true,
          quantity: parsedQuantity,
        })
        .eq("id", mealLog.id)
        .select()
        .single();

      if (error) {
        alert("Error updating meal log");
        setSaving(false);
        return;
      }

      setMealLog(data);
    } else {
      const { data, error } = await supabase
        .from("meal_logs")
        .insert([
          {
            client_id: client.id,
            recipe_id: recipe.id,
            log_date: today,
            completed: true,
            quantity: parsedQuantity,
          },
        ])
        .select()
        .single();

      if (error) {
        alert("Error saving meal log");
        setSaving(false);
        return;
      }

      setMealLog(data);
    }

    setSaving(false);
    alert("Meal saved!");
  };

  const handleClearMeal = async () => {
    if (!mealLog) return;

    setSaving(true);

    const { data, error } = await supabase
      .from("meal_logs")
      .update({
        completed: false,
        quantity: 0,
      })
      .eq("id", mealLog.id)
      .select()
      .single();

    if (error) {
      alert("Error clearing meal log");
      setSaving(false);
      return;
    }

    setMealLog(data);
    setQuantity("1");
    setSaving(false);
  };

  const totalCalories =
    recipe?.calories && quantity !== ""
      ? recipe.calories * Math.max(1, Number(quantity))
      : recipe?.calories ?? 0;

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow">
        <div className="flex items-center justify-between">
<PageHeader title="Nutrition" backHref="/client/dashboard" />

        </div>

        {loading ? (
          <p className="mt-6 text-slate-800">Loading meal...</p>
        ) : !recipe ? (
          <p className="mt-6 text-slate-800">Meal not found.</p>
        ) : (
          <div className="mt-6 space-y-4">
            {recipe.image_url && (
              <img
                src={recipe.image_url}
                alt={recipe.name}
                className="w-full rounded-xl border border-slate-200 object-cover"
              />
            )}

            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                {recipe.name}
              </h2>
              <p className="mt-1 text-slate-800">
                {recipe.description || "No description"}
              </p>
              <p className="mt-2 text-slate-900">
                Calories per portion: {recipe.calories ?? "-"}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">Today's Meal Log</h3>
                  <p className="text-sm text-slate-800">{today}</p>

                  <div className="mt-3">
                    <label className="text-sm font-medium">Quantity eaten</label>
                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 sm:max-w-[160px]"
                    />
                  </div>

                  <p className="mt-3 text-sm text-slate-900">
                    Total calories: <strong>{totalCalories} kcal</strong>
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleSaveMeal}
                    disabled={saving}
                    className="rounded-xl bg-black px-4 py-2 text-white"
                  >
                    {saving ? "Saving..." : "Save Meal"}
                  </button>

                  {mealLog?.completed && (
                    <button
                      onClick={handleClearMeal}
                      disabled={saving}
                      className="rounded-xl border border-slate-300 px-4 py-2"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900">Ingredients</h3>
              <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm text-slate-900">
                {recipe.ingredients || "No ingredients"}
              </pre>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900">Instructions</h3>
              <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm text-slate-900">
                {recipe.instructions || "No instructions"}
              </pre>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}