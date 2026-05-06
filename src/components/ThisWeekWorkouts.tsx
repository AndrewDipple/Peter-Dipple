"use client";

import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { formatWeekLabel } from "@/lib/dates";
import { styles } from "@/lib/design";

type ProgramDay = {
  id: string;
  day_name: string | null;
  sort_order: number | null;
};

type WorkoutCompletion = {
  client_program_day_id: string;
  completed_date: string;
};

type ThisWeekWorkoutsProps = {
  days: ProgramDay[];
  completions: WorkoutCompletion[];
  currentDayId: string | null;
  weekStart: string;
};

export default function ThisWeekWorkouts({
  days,
  completions,
  currentDayId,
  weekStart,
}: ThisWeekWorkoutsProps) {
  if (days.length === 0) return null;

  const sortedDays = [...days].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );

  return (
    <div className={styles.card}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className={styles.h2}>This Week's Workouts</h2>
          <p className="mt-1 text-sm text-ink-muted">{formatWeekLabel(weekStart)}</p>
        </div>
        <Link
          href="/client/workout"
          className="inline-flex items-center gap-2 text-sm font-medium text-ink hover:text-gold"
        >
          Open workout <ArrowRight size={14} />
        </Link>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {sortedDays.map((day) => {
          const completedThisWeek = completions.some(
            (completion) => completion.client_program_day_id === day.id
          );
          const isNext = day.id === currentDayId && !completedThisWeek;

          return (
            <div
              key={day.id}
              className={`rounded-lg border px-3 py-3 ${
                completedThisWeek
                  ? "border-emerald bg-emerald/10"
                  : isNext
                  ? "border-gold bg-gold/10"
                  : "border-border-subtle bg-surface-sunken"
              }`}
            >
              <div className="flex items-center gap-2">
                {completedThisWeek ? (
                  <CheckCircle2 size={18} className="text-emerald" />
                ) : (
                  <Circle size={18} className={isNext ? "text-gold" : "text-ink-muted"} />
                )}
                <p className="font-medium text-ink">{day.day_name || "Workout Day"}</p>
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                {completedThisWeek ? "Done this week" : isNext ? "Up next" : "Pending"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
