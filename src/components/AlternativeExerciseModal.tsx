"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { X, RefreshCw, Check } from "lucide-react";
import { styles } from "@/lib/design";
import { ChevronLeft, ChevronRight} from "lucide-react";

type Exercise = {
  id: string;
  name: string;
  alternate: string | null;
};

type AlternativeExercise = {
  id: string;
  name: string;
  target_muscle: string | null;
  movement_type: string | null;
  primary_equipment: string | null;
};

type AlternativeExerciseModalProps = {
  exercise: Exercise | null;
  clientProgramDayExerciseId: string | null;
  onClose: () => void;
  onSwapped: () => void;
};

export default function AlternativeExerciseModal({
  exercise,
  clientProgramDayExerciseId,
  onClose,
  onSwapped,
}: AlternativeExerciseModalProps) {
  const [alternatives, setAlternatives] = useState<AlternativeExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [swapping, setSwapping] = useState<string | null>(null);

  useEffect(() => {
    if (exercise?.alternate?.trim()) {
      loadAlternatives();
    } else {
      setAlternatives([]);
      setLoading(false);
    }
  }, [exercise]);

  const loadAlternatives = async () => {
    if (!exercise?.alternate?.trim()) return;

    setLoading(true);

    const alternativeNames = exercise.alternate
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);

    if (alternativeNames.length === 0) {
      setAlternatives([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("exercises")
      .select("id, name, target_muscle, movement_type, primary_equipment");

    if (error) {
      console.error("Error loading alternatives:", error);
      setAlternatives([]);
      setLoading(false);
      return;
    }

    const normalisedAlternativeNames = new Set(
      alternativeNames.map((name) => name.toLowerCase())
    );

    const matchingAlternatives =
      data?.filter((item) =>
        normalisedAlternativeNames.has(item.name.toLowerCase().trim())
      ) ?? [];

    setAlternatives(matchingAlternatives);
    setLoading(false);
  };

  const handleSwap = async (alternativeExerciseId: string) => {
    if (!clientProgramDayExerciseId || !exercise) return;

    setSwapping(alternativeExerciseId);

    const { error } = await supabase
      .from("client_program_day_exercises")
      .update({
        exercise_id: alternativeExerciseId,
        original_exercise_id: exercise.id,
      })
      .eq("id", clientProgramDayExerciseId);

    if (error) {
      console.error("Error swapping exercise:", error);
      alert("Failed to swap exercise. Please try again.");
      setSwapping(null);
      return;
    }

    setSwapping(null);
    onSwapped();
    onClose();
  };

  if (!exercise) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-border-subtle bg-surface-raised bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-border-subtle p-6">
          <div>
            <h2 className="text-xl font-bold text-ink">Alternative Exercises</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Swapping out:{" "}
              <span className="font-semibold">{exercise.name}</span>
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-ink-muted hover:bg-surface-sunken hover:text-ink"
          >
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-6">
          {loading ? (
            <p className="text-center text-sm text-ink-muted">
              Loading alternatives...
            </p>
          ) : alternatives.length === 0 ? (
            <div className="rounded-xl border border-border-subtle bg-surface-sunken p-8 text-center">
              <p className="text-sm text-ink-muted">
                No matching alternative exercise was found.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {alternatives.map((alt) => (
                <div
                  key={alt.id}
                  className="rounded-xl border border-border-subtle bg-surface-sunken p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-ink">{alt.name}</h3>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {alt.primary_equipment && (
                          <span className="rounded-full bg-surface-raised px-3 py-1 text-xs font-medium text-ink-muted">
                            {alt.primary_equipment}
                          </span>
                        )}

                        {alt.target_muscle && (
                          <span className="rounded-full bg-surface-raised px-3 py-1 text-xs font-medium text-ink-muted">
                            {alt.target_muscle}
                          </span>
                        )}

                        {alt.movement_type && (
                          <span className="rounded-full bg-surface-raised px-3 py-1 text-xs font-medium text-ink-muted">
                            {alt.movement_type}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleSwap(alt.id)}
                      disabled={swapping !== null}
                      className="flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-medium text-ink transition hover:bg-gold/90 disabled:opacity-50"
                    >
                      {swapping === alt.id ? (
                        <>
                          <RefreshCw size={16} className="animate-spin" />
                          Swapping...
                        </>
                      ) : (
                        <>
                          <Check size={16} />
                          Use This
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border-subtle p-6">
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-border-subtle bg-surface-sunken px-4 py-2 text-sm font-medium text-ink hover:bg-surface-raised"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
