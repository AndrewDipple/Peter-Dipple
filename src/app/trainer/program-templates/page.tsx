"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/PageHeader";
import { styles } from "@/lib/design";

type ProgramTemplate = {
  id: string;
  name: string;
  duration_weeks: number | null;
  days_per_week: number | null;
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

export default function TrainerProgramTemplatesPage() {
  const [templates, setTemplates] = useState<ProgramTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTemplates = async () => {
      const { data, error } = await supabase
        .from("program_templates")
        .select("*")
        .order("duration_weeks", { ascending: true })
        .order("days_per_week", { ascending: true });

      if (!error && data) {
        setTemplates(data);
      }

      setLoading(false);
    };

    loadTemplates();
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow">
        <div className="flex items-center justify-between">
<PageHeader title="Programme Templates" showTrainerNav />
          <Link
            href="/trainer/dashboard"
            className="rounded-xl border border-slate-300 px-4 py-2"
          >
            Back
          </Link>
        </div>

        <div className="mt-6 space-y-3">
          {loading ? (
            <p className="text-slate-800">Loading templates...</p>
          ) : templates.length === 0 ? (
            <p className="text-slate-800">No templates yet.</p>
          ) : (
            templates.map((template) => (
              <Link
                key={template.id}
href={`/trainer/program-templates/${template.id}`}              >
                <div className="cursor-pointer rounded-xl border border-slate-200 p-4 transition hover:bg-slate-50">
                  <h2 className="font-semibold text-slate-900">
                    {template.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-800">
                    {template.duration_weeks ?? "-"} weeks •{" "}
                    {template.days_per_week ?? "-"} days per week
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