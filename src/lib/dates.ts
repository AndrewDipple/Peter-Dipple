// Build a YYYY-MM-DD from a Date, using local time components
// (so "today" matches the user's calendar, not UTC).
export const toLocalDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Parse YYYY-MM-DD into a local Date at midnight (no timezone shift).
export const parseLocalDate = (dateStr: string): Date => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
};

// Returns the Monday of the week containing the given date string.
export const getMondayOf = (dateStr: string): string => {
  const d = parseLocalDate(dateStr);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toLocalDateStr(d);
};

// Returns the Sunday of the week containing the given date string.
export const getSundayOf = (dateStr: string): string => {
  const d = parseLocalDate(dateStr);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return toLocalDateStr(d);
};

export const todayStr = (): string => toLocalDateStr(new Date());

// Add `days` to a YYYY-MM-DD date string, returning a new YYYY-MM-DD string.
export const addDays = (dateStr: string, days: number): string => {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return toLocalDateStr(d);
};

export const buildWeekDates = (mondayStr: string): string[] =>
  Array.from({ length: 7 }, (_, i) => addDays(mondayStr, i));

export const formatShortDate = (dateStr: string): string => {
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

export const formatLongDate = (dateStr: string): string => {
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export const formatWeekLabel = (mondayStr: string): string => {
  const sundayStr = addDays(mondayStr, 6);
  return `${formatShortDate(mondayStr)} – ${formatShortDate(sundayStr)}`;
};

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DAY_LABELS_LONG = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
