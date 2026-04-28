"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";

type ProgramTemplate = {
  id: string;
  name: string;
  duration_weeks: number | null;
  days_per_week: number | null;
};



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
    <>
      <h1 className={styles.display}>Programme Templates</h1>

      <div className="mt-6 space-y-3">
        {loading ? (
          <p className={styles.body}>Loading templates...</p>
        ) : templates.length === 0 ? (
          <p className={styles.body}>No templates yet.</p>
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