"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";
import { formatWeekLabel } from "@/lib/dates";
import {
  awardBondXp,
  getActiveCompanionView,
  isCompanionEnabledForClient,
  type ActiveCompanionView,
} from "@/lib/companions";
import { X } from "lucide-react";

type WeeklyCheckInCardProps = {
  clientId: string;
  weekStart: string;
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
  energy_level: "3",
  hunger_level: "3",
  motivation_level: "3",
  soreness_level: "3",
  sleep_quality: "3",
};

export default function WeeklyCheckInCard({
  clientId,
  weekStart,
  presentation = "card",
}: WeeklyCheckInCardProps) {
  const [completed, setCompleted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [ratings, setRatings] = useState<Ratings>(emptyRatings);
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
    setSaving(true);

    const { error } = await supabase.from("client_weekly_check_ins").upsert(
      {
        client_id: clientId,
        week_start: weekStart,
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

    if (error) {
      alert(`Check-in could not be saved: ${error.message}`);
      setSaving(false);
      return;
    }

    setCompleted(true);
    await awardBondXp(
      clientId,
      25,
      `weekly_check_in_${weekStart}`,
      "Submitted weekly check-in"
    );
    setSaving(false);
  };

  if (loading || completed || dismissed) return null;

  const companionDisplayName = companionView
    ? companionView.companion.custom_name ??
      companionView.path.default_name ??
      companionView.path.name
    : null;

  const content = (
    <div className={styles.card}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-gold">
            Weekly Check-In
          </p>
          <h2 className={`${styles.h2} mt-1`}>How are you getting on?</h2>
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

      <div className="mt-4 grid gap-3 md:grid-cols-5">
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
          Anything your trainer should know?
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
      <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/60 p-4">
        <div className="w-full max-w-3xl">{content}</div>
      </div>
    );
  }

  return content;
}
