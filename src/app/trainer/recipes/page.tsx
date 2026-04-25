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
};

export default function TrainerRecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRecipes = async () => {
      const { data, error } = await supabase
        .from("recipes")
        .select("id, name, description, calories")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setRecipes(data);
      }

      setLoading(false);
    };

    loadRecipes();
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow">
        <div className="flex items-center justify-between">
  
<PageHeader title="Recipes" showTrainerNav />

        </div>

        <div className="mt-6 space-y-3">
          {loading ? (
            <p className="text-slate-800">Loading recipes...</p>
          ) : recipes.length === 0 ? (
            <p className="text-slate-800">No recipes yet.</p>
          ) : (
            recipes.map((recipe) => (
              <Link key={recipe.id} href={`/trainer/recipes/${recipe.id}`}>
                <div className="cursor-pointer rounded-xl border border-slate-200 p-4 hover:bg-slate-50">
                  <h2 className="font-semibold text-slate-900">{recipe.name}</h2>
                  <p className="mt-1 text-sm text-slate-800">
                    {recipe.description || "No description"}
                  </p>
                  <p className="mt-2 text-sm text-slate-900">
                    Calories: {recipe.calories ?? "-"}
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </main>
  );
}