"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useClientFeatures } from "@/contexts/ClientFeaturesContext";
import { styles } from "@/lib/design";
import {
  getActiveCompanionView,
  isCompanionEnabledForClient,
  type ActiveCompanionView,
} from "@/lib/companions";
import { splitRecipeProTips } from "@/lib/recipeTips";

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
  const router = useRouter();
  const { includesNutrition } = useClientFeatures();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [mealLog, setMealLog] = useState<MealLog | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companionView, setCompanionView] = useState<ActiveCompanionView | null>(null);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!includesNutrition) {
      router.replace("/client/dashboard");
    }
  }, [includesNutrition, router]);

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

        const companionEnabled = await isCompanionEnabledForClient(clientData.id);
        setCompanionView(
          companionEnabled ? await getActiveCompanionView(clientData.id) : null
        );

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
  const { instructionsWithoutTips, proTips } = splitRecipeProTips(
    recipe?.instructions
  );
  const companionDisplayName = companionView
    ? companionView.companion.custom_name ??
      companionView.path.default_name ??
      companionView.path.name
    : null;

return (
    <>
      <div className="mb-6 flex items-center gap-4">
        <Link href="/client/nutrition" className={styles.buttonSecondary}>
          ← Back
        </Link>
        <h1 className={styles.display}>Nutrition</h1>
      </div>

      {loading ? (
        <p className={styles.body}>Loading meal...</p>
      ) : !recipe ? (
        <p className={styles.body}>Meal not found.</p>
      ) : (
        <div className="space-y-6">
          {recipe.image_url && (
            <img
              src={recipe.image_url}
              alt={recipe.name}
              className="w-full rounded-xl border border-border-subtle object-cover"
            />
          )}

          <div>
            <h2 className={styles.h2}>{recipe.name}</h2>
            <p className="mt-1 text-ink-muted">
              {recipe.description || "No description"}
            </p>
            <p className="mt-2 text-ink">
              Calories per portion: {recipe.calories ?? "-"}
            </p>
          </div>

          <div className={styles.card}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-ink">Today&apos;s Meal Log</h3>
                <p className="text-sm text-ink-muted">{today}</p>

                <div className="mt-3">
                  <label className="text-sm font-medium text-ink">Quantity eaten</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border-subtle px-3 py-2 sm:max-w-[160px]"
                  />
                </div>

                <p className="mt-3 text-sm text-ink">
                  Total calories: <strong>{totalCalories} kcal</strong>
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSaveMeal}
                  disabled={saving}
                  className={styles.buttonPrimaryNutrition}
                >
                  {saving ? "Saving..." : "Save Meal"}
                </button>

                {mealLog?.completed && (
                  <button
                    onClick={handleClearMeal}
                    disabled={saving}
                    className={styles.buttonSecondary}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-ink">Ingredients</h3>
            <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-surface-sunken p-4 text-sm text-ink">
              {recipe.ingredients || "No ingredients"}
            </pre>
          </div>

          <div>
            <h3 className="font-semibold text-ink">Instructions</h3>
            <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-surface-sunken p-4 text-sm text-ink">
              {instructionsWithoutTips || "No instructions"}
            </pre>
          </div>

          {proTips.length > 0 && (
            <div className={`${styles.card} border border-emerald/30 bg-emerald/5`}>
              <div className="flex items-start gap-3">
                {companionView?.currentForm.image_url ? (
                  <img
                    src={companionView.currentForm.image_url}
                    alt={companionView.currentForm.name}
                    className="h-12 w-12 shrink-0 rounded-lg border border-emerald/30 object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-emerald/30 bg-surface-raised text-sm font-semibold text-emerald">
                    PT
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">
                    {companionDisplayName
                      ? `${companionDisplayName}'s cooking note`
                      : "Peter's cooking note"}
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">
                    Worth knowing before you cook this.
                  </p>
                  <div className="mt-3 space-y-2">
                    {proTips.map((tip, index) => (
                      <div
                        key={`${tip.title}-${index}`}
                        className="rounded-md border border-emerald/20 bg-surface-raised px-3 py-2"
                      >
                        <p className="text-sm font-semibold text-ink">{tip.title}</p>
                        {tip.body && (
                          <p className="mt-1 text-sm text-ink-muted">{tip.body}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
