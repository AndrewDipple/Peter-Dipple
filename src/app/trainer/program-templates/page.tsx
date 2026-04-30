"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";

type ProgramTemplate = {
  id: string;
  name: string;
  duration_weeks: number | null;
  days_per_week: number | null;
};

export default function TrainerProgramTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<ProgramTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

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

  const handleCreateTemplate = async () => {
    setCreating(true);

    const { data, error } = await supabase
      .from("program_templates")
      .insert([
        {
          name: "New Programme Template",
          duration_weeks: 4,
          days_per_week: 3,
        },
      ])
      .select()
      .single();

    if (error || !data) {
      alert("Error creating template");
      setCreating(false);
      return;
    }

    router.push(`/trainer/program-templates/${data.id}`);
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className={styles.display}>Programme Templates</h1>
        <button
          onClick={handleCreateTemplate}
          disabled={creating}
          className={styles.buttonPrimary}
        >
          {creating ? "Creating..." : "Create New Template"}
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {loading ? (
          <p className={styles.body}>Loading templates...</p>
        ) : templates.length === 0 ? (
          <div className={styles.card}>
            <p className={styles.body}>
              No templates yet. Click "Create New Template" to get started.
            </p>
          </div>
        ) : (
          templates.map((template) => (
            <Link
              key={template.id}
              href={`/trainer/program-templates/${template.id}`}
            >
              <div className={`${styles.cardInteractive}`}>
                <h2 className="font-semibold text-ink">
                  {template.name}
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  {template.duration_weeks ?? "-"} weeks •{" "}
                  {template.days_per_week ?? "-"} days per week
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
    </>
  );
}