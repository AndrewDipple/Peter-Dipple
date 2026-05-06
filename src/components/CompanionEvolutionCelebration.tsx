"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";

export type CompanionEvolutionCelebrationData = {
  newFormName: string | null;
  newFormImageUrl: string | null;
  becameMastered: boolean;
  awarded: number;
  newXp: number;
};

type CompanionEvolutionCelebrationProps = {
  celebration: CompanionEvolutionCelebrationData | null;
  onClose: () => void;
};

export default function CompanionEvolutionCelebration({
  celebration,
  onClose,
}: CompanionEvolutionCelebrationProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!celebration) {
      setVisible(false);
      return;
    }

    const showTimer = window.setTimeout(() => setVisible(true), 40);
    const closeTimer = window.setTimeout(onClose, 6500);

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(closeTimer);
    };
  }, [celebration, onClose]);

  if (!celebration) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4">
      <div
        className={`relative w-full max-w-md overflow-hidden rounded-lg border border-gold bg-surface-raised p-6 text-center shadow-2xl transition-all duration-500 ${
          visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-2 text-ink-muted hover:bg-surface-sunken hover:text-ink"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold text-ink shadow-raised animate-pulse">
          <Sparkles size={28} />
        </div>

        <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-gold">
          Companion Evolution
        </p>
        <h2 className="mt-1 text-2xl font-bold text-ink">
          {celebration.becameMastered ? "Fully evolved!" : "Your companion evolved!"}
        </h2>

        {celebration.newFormImageUrl && (
          <div className="mt-5 flex justify-center">
            <img
              src={celebration.newFormImageUrl}
              alt={celebration.newFormName ?? "Companion form"}
              className="h-36 w-36 rounded-xl border border-border-subtle object-cover shadow-raised transition duration-700 hover:scale-105"
            />
          </div>
        )}

        <p className="mt-4 text-lg font-semibold text-ink">
          {celebration.newFormName ?? "New form unlocked"}
        </p>
        <p className="mt-2 text-sm text-ink-muted">
          +{celebration.awarded} Bond XP brought them to {celebration.newXp.toLocaleString()} XP.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 rounded-md bg-black px-4 py-2.5 font-semibold text-white transition hover:opacity-90"
        >
          Nice
        </button>
      </div>
    </div>
  );
}

