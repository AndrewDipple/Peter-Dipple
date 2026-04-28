/**
 * PETER TRAINING — Composed Style Patterns
 *
 * Raw design tokens (colours, fonts, radii, shadows) live in globals.css.
 * This file composes those tokens into reusable component patterns.
 *
 * Rule: never put hex codes here. Always reference token utility classes
 * (e.g. bg-surface-raised, text-ink, border-border-subtle).
 */

export const styles = {
  /* ---------------------------------------------------------------- Layout */
  page: "min-h-screen bg-surface-base p-6",
  container: "mx-auto max-w-4xl",

  /* ---------------------------------------------------------------- Surfaces */
  /** Default card — white on off-white background, soft shadow, no border */
  card: "rounded-lg bg-surface-raised p-5 shadow-subtle",

  /** Card that responds to hover (clickable / linked cards) */
  cardInteractive:
    "rounded-lg bg-surface-raised p-5 shadow-subtle transition-all hover:shadow-raised hover:-translate-y-0.5",

  /** Inset / sunken card (info blocks within other cards) */
  cardSunken: "rounded-md bg-surface-sunken p-4",

  /** Dark contrast block — navy, white text */
  cardDeep: "rounded-lg bg-surface-deep p-5 text-white shadow-raised",

  /* ---------------------------------------------------------------- Typography */
  display: "text-4xl font-bold tracking-tight text-ink",       // 36px Bold
  h1:      "text-2xl font-bold text-ink",                       // 28px Bold
  h2:      "text-xl font-semibold text-ink",                    // 20px SemiBold
  body:    "text-base font-medium text-ink-muted",              // 16px Medium
  bodyLight: "text-base font-normal text-ink-muted",            // 16px Regular
  caption: "text-sm text-ink-subtle",                           // 14px Regular
  label:   "text-xs font-medium uppercase tracking-wide text-ink-muted", // 13px Medium upper

  // Legacy aliases — kept so existing pages don't break
  heading: "text-xl font-semibold text-ink",
  subheading: "text-lg font-medium text-ink",
  goldText: "text-gold",

  /* ---------------------------------------------------------------- Buttons */
  /** Primary CTA — solid black, confident */
  buttonPrimary:
    "rounded-md bg-ink px-4 py-2.5 font-semibold text-white transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50",

  /** Section-specific primary buttons */
  buttonPrimaryWorkout: 
    "rounded-md bg-navy px-4 py-2.5 font-semibold text-white transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50",
  
  buttonPrimaryNutrition: 
    "rounded-md bg-emerald px-4 py-2.5 font-semibold text-white transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50",
  
  buttonPrimaryStats: 
    "rounded-md bg-gold px-4 py-2.5 font-semibold text-ink transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50",

  /** Secondary — white pill with subtle border */
  buttonSecondary:
    "rounded-md border border-border-subtle bg-surface-raised px-4 py-2.5 font-medium text-ink transition hover:bg-surface-sunken disabled:opacity-50",

  /** Accent — gold, for rare brand moments only */
  buttonAccent:
    "rounded-md bg-gold px-4 py-2.5 font-semibold text-ink transition hover:opacity-90 disabled:opacity-50",

  /** Success — emerald, for confirmations / positive actions */
  buttonSuccess:
    "rounded-md bg-emerald px-4 py-2.5 font-semibold text-white transition hover:opacity-90 disabled:opacity-50",

  /** Pill-shaped tertiary button (like Info / Warm Up / Swap in workout reference) */
  buttonPill:
    "rounded-full bg-surface-sunken px-4 py-2 text-sm font-medium text-ink transition hover:bg-border-subtle",

  /* ---------------------------------------------------------------- Inputs */
  input:
    "mt-1 w-full rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-ink placeholder:text-ink-subtle focus:border-ink focus:outline-none",

  /* ---------------------------------------------------------------- Status */
  // Status pills — soft backgrounds, no borders, dot for visual signal
  statusGreen: "bg-emerald/10 text-emerald",
  statusAmber: "bg-amber-100/70 text-amber-800",
  statusRed:   "bg-rose-100/70 text-rose-800",
  statusDot: {
    green: "bg-emerald",
    amber: "bg-amber-500",
    red:   "bg-rose-500",
  },

  /* ---------------------------------------------------------------- Legacy */
  navyBg: "bg-navy text-white", // kept for backwards compatibility
} as const;

/**
 * Raw colour values — for the rare case you need them in JS
 * (e.g. Recharts stroke colours). Prefer Tailwind classes elsewhere.
 */
export const colors = {
  ink: "#111111",
  inkMuted: "#2B2B2B",
  surfaceBase: "#FAFAFA",
  surfaceRaised: "#FFFFFF",
  surfaceSunken: "#F2F2F2",
  surfaceDeep: "#1C2A44",
  gold: "#D4AF37",
  emerald: "#1F6F5E",
  navy: "#1C2A44",
} as const;