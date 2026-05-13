"use client";

import { Sparkles, X } from "lucide-react";

export type CompanionEvolutionCelebrationData = {
  oldFormName: string | null;
  oldFormImageUrl: string | null;
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
  if (!celebration) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4">
      <div
        className="relative w-full max-w-md overflow-hidden rounded-lg border border-gold bg-white p-6 text-center shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-black"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold text-ink shadow-raised animate-pulse">
          <Sparkles size={28} />
        </div>

        <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-gold">
          Companion Transformation
        </p>
        <h2 className="mt-1 text-2xl font-bold text-ink">
          {celebration.becameMastered
            ? "Companion mastered!"
            : "Your companion transformed!"}
        </h2>

        {(celebration.oldFormImageUrl || celebration.newFormImageUrl) && (
          <div className="mt-5 flex items-center justify-center gap-3">
            {celebration.oldFormImageUrl && (
              <div className="text-center">
                <img
                  src={celebration.oldFormImageUrl}
                  alt={celebration.oldFormName ?? "Previous companion form"}
                  className="h-24 w-24 rounded-xl border border-border-subtle object-cover opacity-70 shadow-raised"
                />
                <p className="mt-2 text-xs font-medium text-ink-muted">
                  {celebration.oldFormName ?? "Before"}
                </p>
              </div>
            )}

            {celebration.oldFormImageUrl && celebration.newFormImageUrl && (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold text-lg font-bold text-ink shadow-raised">
                &rarr;
              </div>
            )}

            {celebration.newFormImageUrl && (
              <div className="text-center">
                <div className="rounded-2xl bg-gold/15 p-2 ring-2 ring-gold/40">
                  <img
                    src={celebration.newFormImageUrl}
                    alt={celebration.newFormName ?? "Companion form"}
                    className="h-32 w-32 animate-pulse rounded-xl border border-gold object-cover shadow-raised"
                  />
                </div>
                <p className="mt-2 text-xs font-semibold text-gold">
                  {celebration.newFormName ?? "New form"}
                </p>
              </div>
            )}
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

