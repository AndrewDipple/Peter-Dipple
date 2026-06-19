"use client";

import { useState } from "react";
import { styles } from "@/lib/design";
import { X } from "lucide-react";

export type SwitchableProgram = {
  id: string;
  template_name: string | null;
  status: string | null;
};

type Props = {
  currentProgramId: string;
  programs: SwitchableProgram[];
  onConfirm: (targetProgram: SwitchableProgram) => Promise<void>;
  onClose: () => void;
};

export default function ProgramSwitcherModal({ currentProgramId, programs, onConfirm, onClose }: Props) {
  const [selected, setSelected] = useState<SwitchableProgram | null>(null);
  const [switching, setSwitching] = useState(false);

  const others = programs.filter((p) => p.id !== currentProgramId);
  const current = programs.find((p) => p.id === currentProgramId);

  const handleConfirm = async () => {
    if (!selected) return;
    setSwitching(true);
    await onConfirm(selected);
    setSwitching(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className={`${styles.modalCard} w-full max-w-sm`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className={styles.h2}>Switch programme</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Currently: <span className="font-medium text-ink">{current?.template_name ?? "Unknown"}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-ink-muted hover:bg-surface-sunken hover:text-ink"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {!selected ? (
          <div className="mt-5 space-y-2">
            {others.map((program) => (
              <button
                key={program.id}
                onClick={() => setSelected(program)}
                className="w-full rounded-lg border border-border-subtle bg-surface-sunken px-4 py-3 text-left text-sm font-medium text-ink transition hover:border-gold hover:bg-surface-raised"
              >
                {program.template_name ?? "Unnamed programme"}
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-5">
            <div className="rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 text-sm text-ink">
              <p>Switch to <span className="font-semibold">{selected.template_name ?? "this programme"}</span>?</p>
              <p className="mt-1 text-ink-muted">Your progress in each programme is saved separately, so you can switch back any time.</p>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={handleConfirm}
                disabled={switching}
                className={`${styles.buttonPrimary} flex-1 disabled:opacity-50`}
              >
                {switching ? "Switching..." : "Confirm switch"}
              </button>
              <button
                onClick={() => setSelected(null)}
                disabled={switching}
                className={`${styles.buttonSecondary} flex-1`}
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
