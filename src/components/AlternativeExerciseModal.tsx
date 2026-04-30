"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { X, RefreshCw, Check } from "lucide-react";

type Exercise = {
  id: string;
  name: string;
  category: string;
  equipment: string;
  instructions: string;
  alternative_exercises: string[] | null;
};

type AlternativeExercise = {
  id: string;
  name: string;
  category: string;
  equipment: string;
  instructions: string;
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
    if (exercise?.alternative_exercises && exercise.alternative_exercises.length > 0) {
      loadAlternatives();
    } else {
      setLoading(false);
    }
  }, [exercise]);

  const loadAlternatives = async () => {
    if (!exercise?.alternative_exercises) return;

    const { data, error } = await supabase
      .from("exercises")
      .select("id, name, category, equipment, instructions")
      .in("id", exercise.alternative_exercises);

    if (error) {
      console.error("Error loading alternatives:", error);
      setAlternatives([]);
    } else {
      setAlternatives(data || []);
    }

    setLoading(false);
  };

  const handleSwap = async (alternativeExerciseId: string) => {
    if (!clientProgramDayExerciseId) return;

    setSwapping(alternativeExerciseId);

    // Update the client_program_day_exercises table to point to the new exercise
    const { error } = await supabase
      .from("client_program_day_exercises")
      .update({ exercise_id: alternativeExerciseId })
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
      <div className="w-full max-w-2xl rounded-xl border border-border-subtle bg-surface-raised shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle p-6">
          <div>
            <h2 className="text-xl font-bold text-ink">Alternative Exercises</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Swapping out: <span className="font-semibold">{exercise.name}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-ink-muted hover:bg-surface-sunken hover:text-ink"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-6">
          {loading ? (
            <p className="text-center text-sm text-ink-muted">Loading alternatives...</p>
          ) : alternatives.length === 0 ? (
            <div className="rounded-xl border border-border-subtle bg-surface-sunken p-8 text-center">
              <p className="text-sm text-ink-muted">
                No alternative exercises available for this exercise.
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
                        <span className="rounded-full bg-surface-raised px-3 py-1 text-xs font-medium text-ink-muted">
                          {alt.category}
                        </span>
                        <span className="rounded-full bg-surface-raised px-3 py-1 text-xs font-medium text-ink-muted">
                          {alt.equipment}
                        </span>
                      </div>
                      {alt.instructions && (
                        <p className="mt-3 text-sm text-ink-muted line-clamp-2">
                          {alt.instructions}
                        </p>
                      )}
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

        {/* Footer */}
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