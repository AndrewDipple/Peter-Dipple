"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";
import GuideLink from "@/components/GuideLink";
import {
  awardBondXp,
  chooseCompanion,
  deactivateCompanion,
  findClientCompanionForPath,
  getActiveCompanionView,
  getRandomLine,
  getRecentCompanionEvents,
  isCompanionEnabledForClient,
  listAvailablePaths,
  listCompanionCollection,
  renameCompanion,
  type ActiveCompanionView,
  type CompanionCollectionItem,
  type CompanionEvent,
  type CompanionPath,
} from "@/lib/companions";
import { ArrowLeft, Check, Edit2, Lock, Power, Sparkles, X } from "lucide-react";

export default function CompanionPage() {
  const router = useRouter();

  const [clientId, setClientId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [view, setView] = useState<ActiveCompanionView | null>(null);
  const [availablePaths, setAvailablePaths] = useState<CompanionPath[]>([]);
  const [collection, setCollection] = useState<CompanionCollectionItem[]>([]);
  const [recentEvents, setRecentEvents] = useState<CompanionEvent[]>([]);
  const [line, setLine] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [choosingPathId, setChoosingPathId] = useState<string | null>(null);
  const [chosenName, setChosenName] = useState("");
  const [activating, setActivating] = useState(false);

  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [saving, setSaving] = useState(false);

  const loadPage = useCallback(async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

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

    const isEnabled = await isCompanionEnabledForClient(clientData.id);
    setEnabled(isEnabled);
    if (!isEnabled) {
      router.replace("/client/nutrition");
      return;
    }

    const [activeView, paths, collectionItems] = await Promise.all([
      getActiveCompanionView(clientData.id),
      listAvailablePaths(),
      listCompanionCollection(clientData.id),
    ]);

    setView(activeView);
    setAvailablePaths(paths);
    setCollection(collectionItems);

    if (activeView) {
      const [randomLine, events] = await Promise.all([
        getRandomLine(activeView.path.slug, "general"),
        getRecentCompanionEvents(activeView.companion.id, 5),
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
    const timeoutId = window.setTimeout(() => {
      loadPage();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadPage]);

  const startChoosing = async (pathId: string) => {
    if (!clientId) return;

    const collectionItem = collection.find((item) => item.path.id === pathId);
    if (collectionItem && !collectionItem.isUnlocked) {
      alert(collectionItem.unlockLabel ?? "This companion is still locked.");
      return;
    }

    const path = availablePaths.find((availablePath) => availablePath.id === pathId);
    setChoosingPathId(pathId);

    const existing = await findClientCompanionForPath(clientId, pathId);
    setChosenName(existing?.custom_name ?? path?.default_name ?? "");
  };

  const confirmChoice = async () => {
    if (!clientId || !choosingPathId) return;
    setActivating(true);

    const existingForPath = await findClientCompanionForPath(clientId, choosingPathId);
    const isFirstChoice = !existingForPath;
    const path = availablePaths.find((availablePath) => availablePath.id === choosingPathId);
    const trimmedName = chosenName.trim();
    const companionName = trimmedName || path?.default_name || path?.name || "companion";

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

    if (isFirstChoice) {
      await awardBondXp(
        clientId,
        100,
        "chose_companion",
        `Chose ${path?.name ?? "a companion"}`
      );
    }

    if (isFirstChoice) {
      await awardBondXp(
        clientId,
        50,
        "named_companion",
        `Named your companion "${companionName}"`
      );
    }

    setActivating(false);
    setChoosingPathId(null);
    setChosenName("");
    await loadPage();
  };

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

  const handleTurnOff = async () => {
    if (!view) return;
    if (
      !window.confirm(
        "Turn off your companion? Your XP is saved and you can re-activate any time."
      )
    ) {
      return;
    }

    const ok = await deactivateCompanion(view.companion.id);
    if (!ok) {
      alert("Could not turn off companion.");
      return;
    }

    await loadPage();
  };

  const activeCompanionName = view
    ? view.companion.custom_name ?? view.path.default_name ?? view.path.name
    : null;
  const starterItems = collection.filter((item) => item.path.is_starter);
  const lockedItems = collection.filter((item) => !item.isUnlocked);

  const getCompanionTypeLabel = (type: CompanionPath["companion_type"]) => {
    switch (type) {
      case "power":
        return "Power";
      case "fuel":
        return "Fuel";
      case "spirit":
        return "Spirit";
      default:
        return null;
    }
  };

  const getCompanionTypeDescription = (type: CompanionPath["companion_type"]) => {
    switch (type) {
      case "power":
        return "Training energy";
      case "fuel":
        return "Food, growth, and planning";
      case "spirit":
        return "General support and vibes";
      default:
        return null;
    }
  };

  const getPathActionName = (name: string) =>
    name.replace(/\s+companion$/i, "");

  const renderCompanionCard = (
    item: CompanionCollectionItem,
    mode: "starter" | "collection"
  ) => {
    const displayName =
      item.companion?.custom_name ?? item.path.default_name ?? item.path.name;
    const imageUrl = item.currentForm?.image_url ?? item.previewForm?.image_url;
    const isCurrent = view?.path.id === item.path.id;
    const progressLabel =
      item.target !== null
        ? `${Math.min(item.progress, item.target)} / ${item.target}`
        : null;
    const actionName = getPathActionName(item.path.name);
    const typeLabel = getCompanionTypeLabel(item.path.companion_type);
    const typeDescription = getCompanionTypeDescription(item.path.companion_type);

    return (
      <div
        key={item.path.id}
        className={`${styles.card} ${
          item.isUnlocked ? "" : "border border-border-subtle bg-surface-sunken"
        }`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={item.currentForm?.name ?? item.path.name}
              className="h-20 w-20 shrink-0 rounded-lg border border-border-subtle object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface-sunken text-2xl">
              ?
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="break-words text-lg font-semibold text-ink">
                {displayName}
              </h3>
              {isCurrent && (
                <span className="rounded-full bg-emerald/10 px-2 py-0.5 text-xs font-medium text-emerald">
                  Active
                </span>
              )}
              {item.isMastered && (
                <span className="rounded-full bg-gold/10 px-2 py-0.5 text-xs font-medium text-gold">
                  Mastered
                </span>
              )}
              {!item.isUnlocked && (
                <span className="flex items-center gap-1 rounded-full bg-surface-raised px-2 py-0.5 text-xs font-medium text-ink-muted">
                  <Lock size={12} /> Locked
                </span>
              )}
            </div>

            {typeLabel && (
              <p className="mt-1 text-sm font-medium text-gold">
                {typeLabel}
                {typeDescription ? ` - ${typeDescription}` : ""}
              </p>
            )}

            {item.path.description && (
              <p className="mt-1 text-sm text-ink-muted">{item.path.description}</p>
            )}

            {item.companion && (
              <p className="mt-2 text-sm text-ink-muted">
                {item.companion.xp.toLocaleString()} Bond XP
              </p>
            )}

            {!item.isUnlocked && (
              <div className="mt-3">
                <p className="text-sm text-ink-muted">
                  {item.unlockLabel ?? "Locked for now"}
                  {progressLabel ? ` (${progressLabel})` : ""}
                </p>
                {item.target !== null && (
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-emerald"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(0, (item.progress / item.target) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {item.isUnlocked && !isCurrent && (
              <button
                type="button"
                onClick={() => startChoosing(item.path.id)}
                className={`${styles.buttonPrimary} mt-4`}
              >
                {item.companion
                  ? `Switch to ${displayName}`
                  : mode === "starter"
                  ? `Choose ${actionName}`
                  : `Unlock ${actionName}`}
              </button>
            )}

            {isCurrent && mode === "collection" && (
              <p className="mt-4 text-sm font-medium text-emerald">
                Currently travelling with you.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return <p className={`${styles.body} mt-6`}>Loading...</p>;
  }

  if (!enabled) return null;

  return (
    <>
      <div className="mb-6 flex items-center gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-ink-muted hover:text-ink"
        >
          <ArrowLeft size={16} /> Back
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className={styles.display}>Companion</h1>
        <GuideLink guide="companions" label="Watch Peter's companion guide" />
      </div>

      {choosingPathId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lifted">
            <h2 className="text-xl font-semibold text-black">Name your companion</h2>
            <p className="mt-1 text-sm text-gray-600">
              You can rename them later if you change your mind.
            </p>

            <input
              type="text"
              value={chosenName}
              onChange={(event) => setChosenName(event.target.value)}
              autoFocus
              maxLength={30}
              className="mt-4 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-black focus:outline-none"
              style={{ backgroundColor: "#ffffff", color: "#000000" }}
            />

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={confirmChoice}
                disabled={activating}
                className="flex-1 rounded-md bg-black px-4 py-2.5 font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {activating ? "Activating..." : "Confirm"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setChoosingPathId(null);
                  setChosenName("");
                }}
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
        <div className="mt-6 space-y-6">
          <div className={`${styles.card} bg-surface-sunken`}>
            <h2 className={styles.h2}>Choose your first Companion Type</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Power is for training energy. Fuel is for food, growth, and
              planning. Spirit is for general support and vibes. Pick one, or
              carry on without one for now.
            </p>
          </div>

          {starterItems.length === 0 ? (
            <p className={styles.body}>No starter companions are available right now.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              {starterItems.map((item) => renderCompanionCard(item, "starter"))}
            </div>
          )}

          <button
            type="button"
            onClick={() => router.push("/client/dashboard")}
            className={styles.buttonSecondary}
          >
            Continue without a companion
          </button>

          {lockedItems.length > 0 && (
            <div className="space-y-3">
              <h2 className={styles.h2}>Locked companions</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {lockedItems.map((item) => renderCompanionCard(item, "collection"))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-6 space-y-6">
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
                      onChange={(event) => setRenameValue(event.target.value)}
                      maxLength={30}
                      autoFocus
                      className={styles.input}
                    />
                    <button
                      type="button"
                      onClick={confirmRename}
                      disabled={saving}
                      className="rounded-md border border-emerald p-2 text-emerald hover:bg-emerald hover:text-white"
                      aria-label="Save name"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRenaming(false);
                        setRenameValue("");
                      }}
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
                      {activeCompanionName}
                    </h2>
                    <button
                      type="button"
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
                    &quot;{line}&quot;
                  </div>
                )}
              </div>
            </div>
          </div>

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
                <Sparkles size={14} /> Mastered. Fully evolved.
              </p>
            )}
          </div>

          <div className={styles.card}>
            <h3 className="font-semibold text-ink">Companion collection</h3>
            <p className="mt-1 text-sm text-ink-muted">
              Fully evolved companions stay here. You can switch back to them
              any time.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {collection.map((item) => renderCompanionCard(item, "collection"))}
          </div>

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

          <div className={styles.card}>
            <h3 className="font-semibold text-ink">Settings</h3>
            <p className="mt-1 text-sm text-ink-muted">
              You can turn off your companion at any time. Your progress is saved
              and you can resume later.
            </p>
            <button
              type="button"
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
