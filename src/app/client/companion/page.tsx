"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";
import {
  getActiveCompanionView,
  listAvailablePaths,
  chooseCompanion,
  renameCompanion,
  deactivateCompanion,
  getRandomLine,
  getRecentCompanionEvents,
  isCompanionEnabledForClient,
  findClientCompanionForPath,
    awardBondXp, // ← add this

  type ActiveCompanionView,
  type CompanionPath,
  type CompanionEvent,
} from "@/lib/companions";
import { ArrowLeft, Sparkles, Edit2, Check, X, Power } from "lucide-react";

export default function CompanionPage() {
  const router = useRouter();

  const [clientId, setClientId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [view, setView] = useState<ActiveCompanionView | null>(null);
  const [availablePaths, setAvailablePaths] = useState<CompanionPath[]>([]);
  const [recentEvents, setRecentEvents] = useState<CompanionEvent[]>([]);
  const [line, setLine] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Choose flow state
  const [choosingPathId, setChoosingPathId] = useState<string | null>(null);
  const [chosenName, setChosenName] = useState("");
  const [activating, setActivating] = useState(false);

  // Rename state
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [saving, setSaving] = useState(false);

  const loadPage = useCallback(async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login");
      return;
    }

    const { data: clientData } = await supabase
      .from("clients")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (!clientData) {
      setLoading(false);
      return;
    }

    setClientId(clientData.id);

    // Feature flag check — if disabled, kick them back to nutrition.
    const isEnabled = await isCompanionEnabledForClient(clientData.id);
    setEnabled(isEnabled);
    if (!isEnabled) {
      router.replace("/client/nutrition");
      return;
    }

    // Load active companion (if any) and available paths in parallel.
    const [v, paths] = await Promise.all([
      getActiveCompanionView(clientData.id),
      listAvailablePaths(),
    ]);

    setView(v);
    setAvailablePaths(paths);

    // If we have an active companion, fetch a dialogue line and recent events.
    if (v) {
      const [randomLine, events] = await Promise.all([
        getRandomLine(v.path.slug, "general"),
        getRecentCompanionEvents(v.companion.id, 5),
      ]);
      setLine(randomLine);
      setRecentEvents(events);
    } else {
      setLine(null);
      setRecentEvents([]);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  // --- Choose-companion flow ---

const startChoosing = async (pathId: string) => {
  if (!clientId) return;

  const path = availablePaths.find((p) => p.id === pathId);
  setChoosingPathId(pathId);

  // If they've had this companion before, pre-fill their previous name.
  const existing = await findClientCompanionForPath(clientId, pathId);
  if (existing?.custom_name) {
    setChosenName(existing.custom_name);
  } else {
    setChosenName(path?.default_name ?? "");
  }
};

const confirmChoice = async () => {
  if (!clientId || !choosingPathId) return;
  setActivating(true);

  // Check if this is the first time the user has ever chosen this path.
  // We award XP only on first-ever choice, not on re-activation.
  const existingForPath = await findClientCompanionForPath(clientId, choosingPathId);
  const isFirstChoice = !existingForPath;

  // Check if a custom name was provided (and isn't just the default).
  const path = availablePaths.find((p) => p.id === choosingPathId);
  const trimmedName = chosenName.trim();
  const hasCustomName =
    trimmedName.length > 0 &&
    trimmedName !== (path?.default_name ?? "");

  // Whether to award the naming XP — only on first choice with a custom name.
  const isFirstNaming = isFirstChoice && hasCustomName;

  const result = await chooseCompanion(
    clientId,
    choosingPathId,
    trimmedName || null
  );

  if (!result) {
    alert("Could not activate companion.");
    setActivating(false);
    return;
  }

  // Award XP after the companion exists, so awardBondXp can find it as the active companion.
  if (isFirstChoice) {
    await awardBondXp(
      clientId,
      100,
      "chose_companion",
      `Chose ${path?.name ?? "a companion"}`
    );
  }

  if (isFirstNaming) {
    await awardBondXp(
      clientId,
      50,
      "named_companion",
      `Named your companion "${trimmedName}"`
    );
  }

  setActivating(false);
  setChoosingPathId(null);
  setChosenName("");
  await loadPage();
};

  const cancelChoice = () => {
    setChoosingPathId(null);
    setChosenName("");
  };

  // --- Rename flow ---

  const startRename = () => {
    setRenameValue(view?.companion.custom_name ?? view?.path.default_name ?? "");
    setRenaming(true);
  };

  const confirmRename = async () => {
    if (!view) return;
    setSaving(true);

    const ok = await renameCompanion(view.companion.id, renameValue);
    if (!ok) {
      alert("Could not rename.");
      setSaving(false);
      return;
    }

    setSaving(false);
    setRenaming(false);
    await loadPage();
  };

  const cancelRename = () => {
    setRenaming(false);
    setRenameValue("");
  };

  // --- Turn off ---

  const handleTurnOff = async () => {
    if (!view) return;
    if (!window.confirm(
      "Turn off your companion? Your XP is saved — you can re-activate any time."
    )) return;

    const ok = await deactivateCompanion(view.companion.id);
    if (!ok) {
      alert("Could not turn off companion.");
      return;
    }

    await loadPage();
  };

  // --- Render ---

  if (loading) {
    return <p className={`${styles.body} mt-6`}>Loading...</p>;
  }

  if (!enabled) {
    // Should have redirected; render nothing as a safety.
    return null;
  }

  return (
    <>
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-ink-muted hover:text-ink"
        >
          <ArrowLeft size={16} /> Back
        </button>
      </div>

      <h1 className={styles.display}>Companion</h1>

      {/* Choose-companion overlay */}
      {choosingPathId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lifted">
            <h2 className="text-xl font-semibold text-black">Name Your Companion</h2>
            <p className="mt-1 text-sm text-gray-600">
              You can rename them later if you change your mind.
            </p>

            <input
              type="text"
              value={chosenName}
              onChange={(e) => setChosenName(e.target.value)}
              autoFocus
              maxLength={30}
              className="mt-4 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-black focus:outline-none"
              style={{ backgroundColor: "#ffffff", color: "#000000" }}
            />

            <div className="mt-4 flex gap-2">
              <button
                onClick={confirmChoice}
                disabled={activating}
                className="flex-1 rounded-md bg-black px-4 py-2.5 font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {activating ? "Activating..." : "Confirm"}
              </button>
              <button
                onClick={cancelChoice}
                disabled={activating}
                className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2.5 font-medium text-black hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {!view ? (
        // ---------- No active companion: show chooser ----------
        <div className="mt-6 space-y-6">
          <div className={`${styles.card} bg-surface-sunken`}>
            <h2 className={styles.h2}>Choose a Companion</h2>
            <p className="mt-2 text-sm text-ink-muted">
              A small sidekick that grows alongside you. They earn Bond XP as you
              engage with the app and the coaching process. Optional and
              non-judgemental — pick one if it sounds fun, skip if not.
            </p>
          </div>

          {availablePaths.length === 0 ? (
            <p className={styles.body}>No companions are available right now.</p>
          ) : (
            <div className="space-y-3">
              {availablePaths.map((path) => (
                <div key={path.id} className={styles.card}>
                  <h3 className="text-lg font-semibold text-ink">{path.name}</h3>
                  {path.description && (
                    <p className="mt-1 text-sm text-ink-muted">{path.description}</p>
                  )}
                  <button
                    onClick={() => startChoosing(path.id)}
                    className={`${styles.buttonPrimary} mt-4`}
                  >
                    Choose {path.name}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        // ---------- Has active companion: show companion card ----------
        <div className="mt-6 space-y-6">
          {/* Hero card */}
          <div className={styles.card}>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              {view.currentForm.image_url ? (
                <img
                  src={view.currentForm.image_url}
                  alt={view.currentForm.name}
                  className="h-32 w-32 rounded-xl border border-border-subtle object-cover"
                />
              ) : (
                <div className="flex h-32 w-32 items-center justify-center rounded-xl border border-border-subtle bg-surface-sunken text-4xl">
                  ?
                </div>
              )}

              <div className="flex-1 text-center sm:text-left">
                {renaming ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      maxLength={30}
                      autoFocus
                      className={styles.input}
                    />
                    <button
                      onClick={confirmRename}
                      disabled={saving}
                      className="rounded-md border border-emerald p-2 text-emerald hover:bg-emerald hover:text-white"
                      aria-label="Save name"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={cancelRename}
                      disabled={saving}
                      className="rounded-md border border-border-subtle p-2 text-ink-muted hover:border-red-300 hover:text-red-600"
                      aria-label="Cancel"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 sm:justify-start">
                    <h2 className="text-2xl font-bold text-ink">
                      {view.companion.custom_name ?? view.path.default_name ?? view.path.name}
                    </h2>
                    <button
                      onClick={startRename}
                      className="rounded p-1 text-ink-muted hover:text-ink"
                      aria-label="Rename"
                    >
                      <Edit2 size={14} />
                    </button>
                  </div>
                )}

                <p className="mt-1 text-sm font-medium text-emerald">
                  {view.currentForm.name}
                </p>
                {view.currentForm.description && (
                  <p className="mt-2 text-sm text-ink-muted">
                    {view.currentForm.description}
                  </p>
                )}

                {line && (
                  <div className="mt-4 rounded-lg bg-surface-sunken p-3 text-sm italic text-ink">
                    "{line}"
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Progress card */}
          <div className={styles.card}>
            <div className="flex items-baseline justify-between">
              <h3 className="font-semibold text-ink">Bond XP</h3>
              <span className="text-sm font-medium text-ink">
                {view.companion.xp.toLocaleString()}
                {view.nextForm && ` / ${view.nextForm.xp_required.toLocaleString()}`}
              </span>
            </div>

            <div className="mt-3 h-3 overflow-hidden rounded-full bg-surface-sunken">
              <div
                className="h-full bg-emerald transition-all"
                style={{ width: `${view.progressPct}%` }}
              />
            </div>

            {view.nextForm ? (
              <p className="mt-3 text-sm text-ink-muted">
                {view.xpToNextForm} XP to evolve into{" "}
                <span className="font-medium text-ink">{view.nextForm.name}</span>.
              </p>
            ) : (
              <p className="mt-3 flex items-center gap-2 text-sm font-medium text-emerald">
                <Sparkles size={14} /> Mastered — fully evolved.
              </p>
            )}
          </div>

          {/* Recent events */}
          {recentEvents.length > 0 && (
            <div className={styles.card}>
              <h3 className="font-semibold text-ink">Recent Activity</h3>
              <div className="mt-3 space-y-2">
                {recentEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="text-ink">
                      {event.description ?? event.event_type}
                    </span>
                    <span className="font-medium text-emerald">
                      +{event.xp_awarded} XP
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Off / settings */}
          <div className={styles.card}>
            <h3 className="font-semibold text-ink">Settings</h3>
            <p className="mt-1 text-sm text-ink-muted">
              You can turn off your companion at any time. Your progress is saved
              and you can resume later.
            </p>
            <button
              onClick={handleTurnOff}
              className="mt-4 flex items-center gap-2 rounded-xl border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <Power size={14} />
              Turn off companion
            </button>
          </div>
        </div>
      )}
    </>
  );
}