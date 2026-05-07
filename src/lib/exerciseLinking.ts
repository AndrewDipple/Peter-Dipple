import { supabase } from "@/lib/supabase";

/**
 * Given a list of exercise names, return a map of normalised name → exercise_id
 * by querying the exercises table. Names are matched case-insensitively and
 * whitespace-trimmed, mirroring the backfill SQL we ran on Saturday.
 *
 * Names with no match in the exercises table are simply absent from the
 * returned map (caller should handle nulls).
 */
export const lookupExerciseIdsByName = async (
  names: (string | null | undefined)[]
): Promise<Map<string, string>> => {
  const cleanedNames = Array.from(
    new Set(
      names
        .filter((n): n is string => Boolean(n))
        .map((n) => n.trim())
        .filter((n) => n.length > 0)
    )
  );

  if (cleanedNames.length === 0) return new Map();

  // Fetch exercises and build a normalised lookup in JS. Supabase `.in()` is
  // case-sensitive, which can miss valid exercise names with casing/spacing
  // differences and leave client programme rows without video metadata.
  const { data, error } = await supabase
    .from("exercises")
    .select("id, name");

  if (error || !data) {
    // If we can't reach exercises, fall back gracefully — caller will insert
    // rows without exercise_id, same as before. The backfill SQL can fix later.
    return new Map();
  }

  // Build normalised map: lowercased+trimmed name → exercise id
  const requestedNames = new Set(
    cleanedNames.map((name) => name.toLowerCase().trim())
  );

  const map = new Map<string, string>();
  for (const row of data) {
    if (row.name && requestedNames.has(row.name.toLowerCase().trim())) {
      map.set(row.name.toLowerCase().trim(), row.id);
    }
  }
  return map;
};

/**
 * Helper: get the exercise_id for a single name, given the map.
 * Returns null if no match.
 */
export const getExerciseIdForName = (
  map: Map<string, string>,
  name: string | null | undefined
): string | null => {
  if (!name) return null;
  return map.get(name.toLowerCase().trim()) ?? null;
};
