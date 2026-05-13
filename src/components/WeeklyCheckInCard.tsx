"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";
import { addDays, formatWeekLabel, getMondayOf } from "@/lib/dates";
import {
  awardBondXp,
  COMPANION_XP_REWARDS,
  getActiveCompanionView,
  isCompanionEnabledForClient,
  type ActiveCompanionView,
} from "@/lib/companions";
import { X } from "lucide-react";

type WeeklyCheckInCardProps = {
  clientId: string;
  weekStart: string;
  onboardingCompletedAt?: string | null;
  presentation?: "card" | "modal";
};

const ratingFields = [
  { key: "energy_level", label: "Energy" },
  { key: "hunger_level", label: "Hunger" },
  { key: "motivation_level", label: "Motivation" },
  { key: "soreness_level", label: "Soreness" },
  { key: "sleep_quality", label: "Sleep" },
] as const;

type RatingKey = (typeof ratingFields)[number]["key"];

type Ratings = Record<RatingKey, string>;

const emptyRatings: Ratings = {
  energy_level: "",
  hunger_level: "",
  motivation_level: "",
  soreness_level: "",
  sleep_quality: "",
};

const getFirstCheckInWeek = (
  weekStart: string,
  onboardingCompletedAt: string | null | undefined
) => {
  if (!onboardingCompletedAt) return weekStart;

  const onboardingDate = onboardingCompletedAt.slice(0, 10);
  const onboardingWeekStart = getMondayOf(onboardingDate);
  const firstFullWeekStart = addDays(onboardingWeekStart, 7);

  return addDays(firstFullWeekStart, 7);
};

export default function WeeklyCheckInCard({
  clientId,
  weekStart,
  onboardingCompletedAt,
  presentation = "card",
}: WeeklyCheckInCardProps) {
  const [completed, setCompleted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [ratings, setRatings] = useState<Ratings>(emptyRatings);
  const [weightKg, setWeightKg] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [companionView, setCompanionView] = useState<ActiveCompanionView | null>(null);

  useEffect(() => {
    const loadCheckIn = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("client_weekly_check_ins")
        .select("id")
        .eq("client_id", clientId)
        .eq("week_start", weekStart)
        .maybeSingle();

      setCompleted(Boolean(data));
      setLoading(false);
    };

    loadCheckIn();
  }, [clientId, weekStart]);

  useEffect(() => {
    let cancelled = false;

    const loadCompanion = async () => {
      const companionEnabled = await isCompanionEnabledForClient(clientId);
      const activeCompanion = companionEnabled
        ? await getActiveCompanionView(clientId)
        : null;

      if (!cancelled) {
        setCompanionView(activeCompanion);
      }
    };

    loadCompanion();

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const handleSubmit = async () => {
    const parsedWeight = Number(weightKg);
    const ratingsComplete = ratingFields.every((field) => ratings[field.key]);

    if (!ratingsComplete) {
      alert("Please select all check-in ratings.");
      return;
    }

    if (!parsedWeight || parsedWeight <= 0) {
      alert("Please enter your current weight.");
      return;
    }

    setSaving(true);

    try {
      const { error: weightError } = await supabase
        .from("client_weight_logs")
        .insert({
          client_id: clientId,
          weight_kg: parsedWeight,
          log_date: weekStart,
          note: `Weekly check-in ${formatWeekLabel(weekStart)}`,
        });

      if (weightError) throw weightError;

      const { error } = await supabase.from("client_weekly_check_ins").upsert(
        {
          client_id: clientId,
          week_start: weekStart,
          weight_kg: parsedWeight,
          photos_uploaded: false,
          energy_level: Number(ratings.energy_level),
          hunger_level: Number(ratings.hunger_level),
          motivation_level: Number(ratings.motivation_level),
          soreness_level: Number(ratings.soreness_level),
          sleep_quality: Number(ratings.sleep_quality),
          notes: notes.trim() || null,
          submitted_at: new Date().toISOString(),
        },
        { onConflict: "client_id,week_start" }
      );

      if (error) throw error;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      alert(`Check-in could not be saved: ${message}`);
      setSaving(false);
      return;
    }

    setCompleted(true);
    await awardBondXp(
      clientId,
      COMPANION_XP_REWARDS.weeklyCheckInComplete,
      `weekly_check_in_${weekStart}`,
      "Submitted weekly check-in"
    );
    setSaving(false);
  };

  const firstCheckInWeek = getFirstCheckInWeek(weekStart, onboardingCompletedAt);

  if (loading || completed || dismissed || weekStart < firstCheckInWeek) return null;

  const companionDisplayName = companionView
    ? companionView.companion.custom_name ??
      companionView.path.default_name ??
      companionView.path.name
    : null;
  const parsedWeight = Number(weightKg);
  const ratingsComplete = ratingFields.every((field) => ratings[field.key]);
  const requirements = [
    { label: "Ratings", complete: ratingsComplete },
    { label: "Current weight", complete: Boolean(parsedWeight && parsedWeight > 0) },
  ];

  const content = (
    <div
      className={`${
        presentation === "modal" ? styles.modalCard : styles.card
      } ${presentation === "modal" ? "max-h-[calc(100vh-2rem)] overflow-y-auto" : ""}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-gold">
            Weekly Check-In
          </p>
          <h2 className={`${styles.h2} mt-1`}>Weekly progress check</h2>
          <p className="mt-1 text-sm text-ink-muted">{formatWeekLabel(weekStart)}</p>
        </div>
        {presentation === "modal" && (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-full p-1 text-ink-muted hover:bg-surface-sunken hover:text-ink"
            aria-label="Dismiss weekly check-in"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-md border border-emerald/20 bg-emerald/5 p-3">
        {companionView?.currentForm.image_url ? (
          <img
            src={companionView.currentForm.image_url}
            alt={companionView.currentForm.name}
            className="h-10 w-10 shrink-0 rounded-md border border-emerald/30 object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-emerald/30 bg-surface-raised text-xs font-semibold text-emerald">
            PT
          </div>
        )}

        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">
            {companionDisplayName
              ? `${companionDisplayName}'s check-in note`
              : "Check-in note"}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Short and honest is perfect. Peter can use this to adjust your week.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-md border border-border-subtle bg-surface-sunken p-3">
        <p className="text-sm font-semibold text-ink">Check-in progress</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {requirements.map((requirement) => (
            <div
              key={requirement.label}
              className="flex items-center gap-2 text-sm text-ink-muted"
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  requirement.complete
                    ? "bg-emerald text-white"
                    : "border border-border-subtle bg-surface-raised text-ink-muted"
                }`}
              >
                {requirement.complete ? "✓" : ""}
              </span>
              <span>{requirement.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-5">
        <p className="text-xs text-ink-muted md:col-span-5">
          Score each area from 1 low to 5 high.
        </p>
        {ratingFields.map((field) => (
          <div key={field.key}>
            <label className="text-sm font-medium text-ink">{field.label}</label>
            <select
              value={ratings[field.key]}
              onChange={(e) =>
                setRatings((prev) => ({ ...prev, [field.key]: e.target.value }))
              }
              className={styles.select}
            >
              <option value="">Select</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <label className="text-sm font-medium text-ink">
          Current weight (kg)
        </label>
        <input
          type="number"
          step="0.1"
          min="1"
          value={weightKg}
          onChange={(event) => setWeightKg(event.target.value)}
          className={styles.input}
          placeholder="e.g. 82.5"
        />
      </div>

      <div className="mt-4">
        <label className="text-sm font-medium text-ink">
          How has this week felt? <span className="text-ink-muted">(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={styles.textarea}
          rows={3}
          placeholder="Tired, hungry, motivated, stressed, feeling good..."
        />
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={saving}
        className={`${styles.buttonPrimary} mt-4 disabled:opacity-50`}
      >
        {saving ? "Saving..." : "Submit Check-In"}
      </button>
    </div>
  );

  if (presentation === "modal") {
    return (
      <div className="fixed inset-0 z-[180] flex items-start justify-center overflow-y-auto bg-black/60 p-4">
        <div className="my-4 w-full max-w-3xl">{content}</div>
      </div>
    );
  }

  return content;
}
