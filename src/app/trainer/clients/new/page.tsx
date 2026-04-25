"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/PageHeader";
import { styles } from "@/lib/design";

export default function NewClientPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase.from("clients").insert([
      {
        full_name: fullName,
        email: email,
        calorie_target: Number(calories),
        protein_g: Number(protein),
      },
    ]);

    if (error) {
      console.error(error);
      alert("Error saving client");
      return;
    }

    alert("Client created!");
    setFullName("");
    setEmail("");
    setCalories("");
    setProtein("");
  };

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow">
        <h1 className="text-2xl font-bold">Add New Client</h1>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Calorie Target</label>
            <input
              type="number"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Protein (g)</label>
            <input
              type="number"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-black px-4 py-3 text-white"
          >
            Create Client
          </button>
        </form>
      </div>
    </main>
  );
}