import { supabase } from "@/lib/supabase";

// =====================================================================
// Types
// =====================================================================

export type CompanionPath = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  default_name: string | null;
  is_starter: boolean;
  is_active: boolean;
  display_order?: number | null;
  companion_type?: CompanionType | null;
  unlock_requirement_type?: CompanionUnlockRequirementType | null;
  unlock_requirement_target?: number | null;
  unlock_label?: string | null;
};

export type CompanionType = "power" | "fuel" | "spirit";

export type CompanionUnlockRequirementType =
  | "starter"
  | "workouts_completed"
  | "weekly_check_ins"
  | "different_recipes"
  | "water_targets"
  | "milestone_photo_sets"
  | "manual";

export type CompanionForm = {
  id: string;
  path_id: string;
  form_number: number;
  tier_label: string;
  name: string;
  xp_required: number;
  image_url: string | null;
  description: string | null;
};

export type ClientCompanion = {
  id: string;
  client_id: string;
  path_id: string;
  custom_name: string | null;
  xp: number;
  is_active: boolean;
  is_mastered: boolean;
  created_at: string;
  mastered_at: string | null;
};

export type CompanionEvent = {
  id: string;
  client_id: string;
  companion_id: string;
  event_type: string;
  xp_awarded: number;
  description: string | null;
  created_at: string;
};

export type CompanionLine = {
  id: string;
  companion_slug: string | null;
  category: string;
  text: string;
};

// Convenience type that bundles the active companion with its path and form data.
// This is what most UI components actually want.
export type ActiveCompanionView = {
  companion: ClientCompanion;
  path: CompanionPath;
  currentForm: CompanionForm;
  nextForm: CompanionForm | null;
  xpToNextForm: number | null;
  progressPct: number; // 0–100, progress within the current form's range
  isMaxForm: boolean;
};

export type CompanionCollectionItem = {
  path: CompanionPath;
  companion: ClientCompanion | null;
  previewForm: CompanionForm | null;
  currentForm: CompanionForm | null;
  isActive: boolean;
  isMastered: boolean;
  isUnlocked: boolean;
  progress: number;
  target: number | null;
  unlockLabel: string | null;
};

// =====================================================================
// Feature flag
// =====================================================================

// Cheap check the rest of the app can call before doing companion work.
// Cached per-call. Returns false if anything goes wrong (defensive).
export const isCompanionEnabledForClient = async (
  clientId: string
): Promise<boolean> => {
  const { data, error } = await supabase
    .from("clients")
    .select("companion_enabled")
    .eq("id", clientId)
    .maybeSingle();

  if (error || !data) return false;
  return Boolean(data.companion_enabled);
};

// Look up a client's previous companion of a given path, regardless of
// whether it's active. Used to pre-fill the name when reactivating.
export const findClientCompanionForPath = async (
  clientId: string,
  pathId: string
): Promise<ClientCompanion | null> => {
  const { data, error } = await supabase
    .from("client_companions")
    .select("*")
    .eq("client_id", clientId)
    .eq("path_id", pathId)
    .maybeSingle();

  if (error || !data) return null;
  return data as ClientCompanion;
};

// =====================================================================
// Path & form lookups
// =====================================================================

export const listAvailablePaths = async (): Promise<CompanionPath[]> => {
  const { data, error } = await supabase
    .from("companion_paths")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error || !data) return [];
  return data as CompanionPath[];
};

export const listClientCompanions = async (
  clientId: string
): Promise<ClientCompanion[]> => {
  const { data, error } = await supabase
    .from("client_companions")
    .select("*")
    .eq("client_id", clientId);

  if (error || !data) return [];
  return data as ClientCompanion[];
};

export const getFormsForPath = async (
  pathId: string
): Promise<CompanionForm[]> => {
  const { data, error } = await supabase
    .from("companion_forms")
    .select("*")
    .eq("path_id", pathId)
    .order("form_number", { ascending: true });

  if (error || !data) return [];
  return data as CompanionForm[];
};

const getDifferentRecipeCount = async (clientId: string) => {
  const { data, error } = await supabase
    .from("meal_logs")
    .select("recipe_id")
    .eq("client_id", clientId)
    .eq("completed", true)
    .not("recipe_id", "is", null);

  if (error || !data) return 0;

  return new Set(
    data
      .map((row) => row.recipe_id as string | null)
      .filter((recipeId): recipeId is string => Boolean(recipeId))
  ).size;
};

const getUnlockProgress = async (
  clientId: string,
  requirementType: CompanionUnlockRequirementType | null | undefined
) => {
  switch (requirementType) {
    case "workouts_completed": {
      const { count, error } = await supabase
        .from("client_workout_completions")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId);
      return error ? 0 : count ?? 0;
    }
    case "weekly_check_ins": {
      const { count, error } = await supabase
        .from("client_weekly_check_ins")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId);
      return error ? 0 : count ?? 0;
    }
    case "different_recipes":
      return getDifferentRecipeCount(clientId);
    case "water_targets": {
      const { count, error } = await supabase
        .from("daily_tracking")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("water_completed", true);
      return error ? 0 : count ?? 0;
    }
    case "milestone_photo_sets": {
      const { count, error } = await supabase
        .from("client_milestones")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("photos_completed", true);
      return error ? 0 : count ?? 0;
    }
    default:
      return 0;
  }
};

const defaultUnlockLabel = (
  requirementType: CompanionUnlockRequirementType | null | undefined,
  target: number | null | undefined
) => {
  switch (requirementType) {
    case "workouts_completed":
      return `Complete ${target ?? 0} workouts`;
    case "weekly_check_ins":
      return `Submit ${target ?? 0} weekly check-ins`;
    case "different_recipes":
      return `Try ${target ?? 0} different recipes`;
    case "water_targets":
      return `Hit your water target ${target ?? 0} times`;
    case "milestone_photo_sets":
      return `Upload ${target ?? 0} milestone photo set${target === 1 ? "" : "s"}`;
    case "manual":
      return "Locked for now";
    default:
      return null;
  }
};

export const listCompanionCollection = async (
  clientId: string
): Promise<CompanionCollectionItem[]> => {
  const [paths, companions] = await Promise.all([
    listAvailablePaths(),
    listClientCompanions(clientId),
  ]);

  const companionByPathId = new Map(
    companions.map((companion) => [companion.path_id, companion])
  );

  const items = await Promise.all(
    paths.map(async (path) => {
      const companion = companionByPathId.get(path.id) ?? null;
      const forms = await getFormsForPath(path.id);
      const previewForm = forms[0] ?? null;

      let currentForm = previewForm;
      if (companion) {
        for (const form of forms) {
          if (companion.xp >= form.xp_required) currentForm = form;
          else break;
        }
      }

      const target = path.unlock_requirement_target ?? null;
      const requirementType = path.unlock_requirement_type ?? null;
      const isStarter = path.is_starter || requirementType === "starter";
      const progress = isStarter || companion ? target ?? 0 : await getUnlockProgress(clientId, requirementType);
      const isUnlocked =
        isStarter ||
        Boolean(companion) ||
        requirementType === null ||
        (target !== null && progress >= target);

      return {
        path,
        companion,
        previewForm,
        currentForm,
        isActive: Boolean(companion?.is_active),
        isMastered: Boolean(companion?.is_mastered),
        isUnlocked,
        progress,
        target,
        unlockLabel:
          path.unlock_label ?? defaultUnlockLabel(requirementType, target),
      };
    })
  );

  return items.sort((a, b) => {
    const orderA = a.path.display_order ?? 999;
    const orderB = b.path.display_order ?? 999;
    if (orderA !== orderB) return orderA - orderB;
    return a.path.name.localeCompare(b.path.name);
  });
};

// =====================================================================
// Active companion view
// =====================================================================

// The main read function — fetches the active companion + its path + forms,
// then computes derived values (current form, next form, progress).
// Returns null if the client has no active companion.
export const getActiveCompanionView = async (
  clientId: string
): Promise<ActiveCompanionView | null> => {
  // Fetch the active companion row.
  const { data: companion, error: companionErr } = await supabase
    .from("client_companions")
    .select("*")
    .eq("client_id", clientId)
    .eq("is_active", true)
    .maybeSingle();

  if (companionErr || !companion) return null;

  // Fetch the path and its forms in parallel.
  const [pathRes, formsRes] = await Promise.all([
    supabase
      .from("companion_paths")
      .select("*")
      .eq("id", companion.path_id)
      .single(),
    supabase
      .from("companion_forms")
      .select("*")
      .eq("path_id", companion.path_id)
      .order("form_number", { ascending: true }),
  ]);

  if (pathRes.error || !pathRes.data) return null;
  if (formsRes.error || !formsRes.data || formsRes.data.length === 0) return null;

  const path = pathRes.data as CompanionPath;
  const forms = formsRes.data as CompanionForm[];

  // Find the highest form whose xp_required <= current xp.
  // Forms are already sorted by form_number ascending (which matches xp_required).
  let currentForm = forms[0];
  for (const f of forms) {
    if (companion.xp >= f.xp_required) currentForm = f;
    else break;
  }

  const currentIndex = forms.findIndex((f) => f.id === currentForm.id);
  const nextForm = currentIndex < forms.length - 1 ? forms[currentIndex + 1] : null;
  const isMaxForm = nextForm === null;

  let xpToNextForm: number | null = null;
  let progressPct = 100;

  if (nextForm) {
    xpToNextForm = nextForm.xp_required - companion.xp;
    const range = nextForm.xp_required - currentForm.xp_required;
    const within = companion.xp - currentForm.xp_required;
    progressPct = range > 0 ? Math.min(100, Math.max(0, (within / range) * 100)) : 0;
  }

  return {
    companion: companion as ClientCompanion,
    path,
    currentForm,
    nextForm,
    xpToNextForm,
    progressPct,
    isMaxForm,
  };
};

// =====================================================================
// Choose / activate / rename
// =====================================================================

// Activates a path for a client, creating the companion row.
// If the client already has an active companion, deactivates it first.
// Returns the new active companion row, or null on error.
export const chooseCompanion = async (
  clientId: string,
  pathId: string,
  customName: string | null
): Promise<ClientCompanion | null> => {
  // Check if the client already has a row for this path (e.g. they're
  // switching back to a previous companion).
  const { data: existing } = await supabase
    .from("client_companions")
    .select("*")
    .eq("client_id", clientId)
    .eq("path_id", pathId)
    .maybeSingle();

  // Deactivate any currently-active companions for this client.
  await supabase
    .from("client_companions")
    .update({ is_active: false })
    .eq("client_id", clientId)
    .eq("is_active", true);

  if (existing) {
    // Reactivate the existing row, preserving XP.
    const { data, error } = await supabase
      .from("client_companions")
      .update({ is_active: true, custom_name: customName ?? existing.custom_name })
      .eq("id", existing.id)
      .select()
      .single();

    if (error || !data) return null;
    return data as ClientCompanion;
  }

  // No existing row — create a fresh one.
  const { data, error } = await supabase
    .from("client_companions")
    .insert({
      client_id: clientId,
      path_id: pathId,
      custom_name: customName,
      xp: 0,
      is_active: true,
    })
    .select()
    .single();

  if (error || !data) return null;
  return data as ClientCompanion;
};

export const renameCompanion = async (
  companionId: string,
  newName: string
): Promise<boolean> => {
  const { error } = await supabase
    .from("client_companions")
    .update({ custom_name: newName.trim() || null })
    .eq("id", companionId);

  return !error;
};

export const deactivateCompanion = async (
  companionId: string
): Promise<boolean> => {
  const { error } = await supabase
    .from("client_companions")
    .update({ is_active: false })
    .eq("id", companionId);

  return !error;
};

// =====================================================================
// Award XP
// =====================================================================

export type AwardXpResult = {
  awarded: number;
  newXp: number;
  leveledUp: boolean;
  newFormName: string | null;
  newFormImageUrl: string | null;
  becameMastered: boolean;
};

// The headline mutation. Awards Bond XP to the client's active companion,
// records an event, and returns level-up info so callers can celebrate.
//
// Self-disabling: if the feature flag is off, this silently no-ops.
// This means callers can fire awardBondXp() freely without worrying
// about whether the feature is enabled.
export const awardBondXp = async (
  clientId: string,
  amount: number,
  eventType: string,
  description: string | null = null
): Promise<AwardXpResult | null> => {
  if (amount <= 0) return null;

  // Feature flag check — silent no-op if disabled.
  const enabled = await isCompanionEnabledForClient(clientId);
  if (!enabled) return null;

  // Find the active companion.
  const view = await getActiveCompanionView(clientId);
  if (!view) return null; // No active companion, nothing to award to.

  const oldFormNumber = view.currentForm.form_number;
  const oldXp = view.companion.xp;
  const newXp = oldXp + amount;

  // Update the companion's XP.
  const { error: updateErr } = await supabase
    .from("client_companions")
    .update({ xp: newXp })
    .eq("id", view.companion.id);

  if (updateErr) return null;

  // Record the event.
  await supabase.from("companion_events").insert({
    client_id: clientId,
    companion_id: view.companion.id,
    event_type: eventType,
    xp_awarded: amount,
    description,
  });

  // Determine if the XP gain crossed a form threshold.
  const forms = await getFormsForPath(view.path.id);
  let newFormNumber = 1;
  for (const f of forms) {
    if (newXp >= f.xp_required) newFormNumber = f.form_number;
    else break;
  }

  const leveledUp = newFormNumber > oldFormNumber;
  const newForm = forms.find((f) => f.form_number === newFormNumber) ?? null;

  // Check for mastery — reaching the highest form marks as mastered.
  const isHighestForm = newFormNumber === forms[forms.length - 1].form_number;
  const becameMastered = isHighestForm && !view.companion.is_mastered;

  if (becameMastered) {
    await supabase
      .from("client_companions")
      .update({ is_mastered: true, mastered_at: new Date().toISOString() })
      .eq("id", view.companion.id);
  }

  const result = {
    awarded: amount,
    newXp,
    leveledUp,
    newFormName: leveledUp ? newForm?.name ?? null : null,
    newFormImageUrl: leveledUp ? newForm?.image_url ?? null : null,
    becameMastered,
  };

  if (leveledUp && typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("companion:evolved", {
        detail: result,
      })
    );
  }

  return result;
};

// =====================================================================
// Dialogue
// =====================================================================

// Fetch a random line for the given companion + category.
// Falls back to category="general" if no lines match the requested category.
// Falls back to null if there are no lines at all.
export const getRandomLine = async (
  companionSlug: string,
  category: string = "general"
): Promise<string | null> => {
  // Try the requested category first.
  const tryFetch = async (cat: string) => {
    const { data, error } = await supabase
      .from("companion_lines")
      .select("text")
      .eq("companion_slug", companionSlug)
      .eq("category", cat)
      .eq("is_active", true);

    if (error || !data || data.length === 0) return null;
    return data[Math.floor(Math.random() * data.length)].text as string;
  };

  return (await tryFetch(category)) ?? (await tryFetch("general"));
};

// =====================================================================
// Recent events
// =====================================================================

export const getRecentCompanionEvents = async (
  companionId: string,
  limit: number = 10
): Promise<CompanionEvent[]> => {
  const { data, error } = await supabase
    .from("companion_events")
    .select("*")
    .eq("companion_id", companionId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as CompanionEvent[];
};

