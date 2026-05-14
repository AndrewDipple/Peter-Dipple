export type WeightLoggingMode = "per_dumbbell" | "total";

export const isDumbbellEquipment = (equipment?: string | null) => {
  if (!equipment) return false;

  const normalized = equipment.toLowerCase().replace(/[\s_-]+/g, "");
  return normalized.includes("dumbbell") || normalized.includes("dumbell");
};

export const getDefaultWeightLoggingMode = (
  equipment?: string | null
): WeightLoggingMode =>
  isDumbbellEquipment(equipment) ? "per_dumbbell" : "total";

export const getLoggedWeightMultiplier = (
  equipment?: string | null,
  mode?: WeightLoggingMode | null
) => {
  if (mode) return mode === "per_dumbbell" ? 2 : 1;
  return isDumbbellEquipment(equipment) ? 2 : 1;
};
