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
  selectedDayId?: string | null;
  onSelectDay?: (dayId: string) => void;
  showOpenWorkoutLink?: boolean;
  embedded?: boolean;
  metaLabel?: string | null;
};

export default function ThisWeekWorkouts({
  days,
  completions,
  currentDayId,
  weekStart,
  selectedDayId = null,
  onSelectDay,
  showOpenWorkoutLink = true,
  embedded = false,
  metaLabel = null,
}: ThisWeekWorkoutsProps) {
  if (days.length === 0) return null;

  const sortedDays = [...days].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );

  const content = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className={styles.h2}>This Week&apos;s Workouts</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            <span>{formatWeekLabel(weekStart)}</span>
            {metaLabel && (
              <>
                <span aria-hidden="true">|</span>
                <span>{metaLabel}</span>
              </>
            )}
          </div>
        </div>
        {showOpenWorkoutLink && (
          <Link
            href="/client/workout"
            className="inline-flex items-center gap-2 text-sm font-medium text-ink hover:text-gold"
          >
            Open workout <ArrowRight size={14} />
          </Link>
        )}
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {sortedDays.map((day) => {
          const completedThisWeek = completions.some(
            (completion) => completion.client_program_day_id === day.id
          );
          const isNext = day.id === currentDayId && !completedThisWeek;
          const isSelected = selectedDayId === day.id;
          const cardClassName = `rounded-lg border px-3 py-3 text-left transition ${
            isSelected
              ? "border-workout bg-workout/10 ring-2 ring-workout/20"
              : completedThisWeek
              ? "border-emerald bg-emerald/10"
              : isNext
              ? "border-gold bg-gold/10"
              : "border-border-subtle bg-surface-sunken"
          } ${onSelectDay ? "cursor-pointer hover:bg-surface-raised" : ""}`;
          const statusText = completedThisWeek
            ? "Done this week"
            : isSelected
            ? "Selected"
            : isNext
            ? "Up next"
            : "Pending";
          const iconClassName = completedThisWeek
            ? "text-emerald"
            : isSelected
            ? "text-workout"
            : isNext
            ? "text-gold"
            : "text-ink-muted";
          const content = (
            <>
              <div className="flex items-center gap-2">
                {completedThisWeek ? (
                  <CheckCircle2 size={18} className="text-emerald" />
                ) : (
                  <Circle size={18} className={iconClassName} />
                )}
                <p className="font-medium text-ink">{day.day_name || "Workout Day"}</p>
              </div>
              <p className="mt-1 text-xs text-ink-muted">{statusText}</p>
            </>
          );

          return onSelectDay ? (
            <button
              key={day.id}
              type="button"
              onClick={() => onSelectDay(day.id)}
              className={cardClassName}
            >
              {content}
            </button>
          ) : (
            <div key={day.id} className={cardClassName}>
              {content}
            </div>
          );
        })}
      </div>
    </>
  );

  if (embedded) return <div>{content}</div>;

  return (
    <div className={styles.card}>
      {content}
    </div>
  );
}
