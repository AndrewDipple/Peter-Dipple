"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";

type Props = {
  clientId: string;
  initialName: string;
  onComplete: () => void;
};

export default function LightweightOnboardingModal({ clientId, initialName, onComplete }: Props) {
  const [fullName, setFullName] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!fullName.trim()) {
      alert("Please enter your name.");
      return;
    }

    setSubmitting(true);

    const { error } = await supabase
      .from("clients")
      .update({
        full_name: fullName.trim(),
        onboarding_complete: true,
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq("id", clientId);

    if (error) {
      alert("Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }

    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className={`${styles.modalCard} w-full max-w-sm`}>
        <h2 className={styles.h2}>Welcome</h2>
        <p className="mt-1 text-sm text-ink-muted">Confirm your name to get started.</p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-ink">Your name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={styles.input}
              placeholder="Full name"
              autoFocus
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className={`${styles.buttonPrimary} w-full py-3 disabled:opacity-50`}
          >
            {submitting ? "Setting up..." : "Get started"}
          </button>
        </div>
      </div>
    </div>
  );
}
