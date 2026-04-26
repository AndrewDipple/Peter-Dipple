"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { styles } from "@/lib/design";

type Client = {
  id: string;
  full_name: string;
  email: string;
  calorie_target: number | null;
  protein_g: number | null;
};

type Props = {
  params: Promise<{
    id: string;
  }>;
};


export default function EditClientPage({ params }: Props) {
  const [clientId, setClientId] = useState("");
  const [client, setClient] = useState<Client | null>(null);

  const [exerciseLibrary, setExerciseLibrary] = useState<any[]>([]);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");

  useEffect(() => {
    const loadClient = async () => {
      const resolved = await params;
      const id = resolved.id;
      setClientId(id);

const loadExercises = async () => {
  const { data } = await supabase
    .from("exercises")
    .select("*")
    .limit(100);

  if (data) setExerciseLibrary(data);
};

loadExercises();

      const { data } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id)
        .single();

      if (data) {
        setClient(data);
        setFullName(data.full_name);
        setEmail(data.email);
        setCalories(String(data.calorie_target ?? ""));
        setProtein(String(data.protein_g ?? ""));
      }
    };

    loadClient();
  }, [params]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase
      .from("clients")
      .update({
        full_name: fullName,
        email: email,
        calorie_target: Number(calories),
        protein_g: Number(protein),
      })
      .eq("id", clientId);

    if (error) {
      alert("Error updating client");
    } else {
      alert("Client updated!");
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Edit Client</h1>

          <Link
            href={`/trainer/clients/${clientId}`}
            className="rounded-xl border border-slate-300 px-4 py-2"
          >
            Back
          </Link>
        </div>

        {!client ? (
          <p className="mt-6">Loading...</p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium">Full Name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-xl border px-3 py-2"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border px-3 py-2"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Calories</label>
              <input
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                className="mt-1 w-full rounded-xl border px-3 py-2"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Protein</label>
              <input
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                className="mt-1 w-full rounded-xl border px-3 py-2"
              />
            </div>

            <button className="w-full rounded-xl bg-black px-4 py-3 text-white">
              Save Changes
            </button>
          </form>
        )}
      </div>
    </main>
  );
}