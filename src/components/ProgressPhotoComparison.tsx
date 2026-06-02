"use client";

import { ChevronRight, Trash2 } from "lucide-react";

export type ComparisonPhotoType = "front" | "back" | "side";

export type ComparisonProgressPhoto = {
  id: string;
  image_url: string;
  storage_path: string | null;
  signed_url?: string | null;
  log_date: string;
  note: string | null;
  photo_type: ComparisonPhotoType;
};

export type ComparisonPhotoWeek = {
  log_date: string;
  week_number: number;
  front: ComparisonProgressPhoto | null;
  back: ComparisonProgressPhoto | null;
  side: ComparisonProgressPhoto | null;
};

type Props = {
  photoWeeks: ComparisonPhotoWeek[];
  showAllWeeks: boolean;
  onShowAllWeeksChange: (showAllWeeks: boolean) => void;
  getPhotoUrl: (photo: ComparisonProgressPhoto) => string;
  onPhotoClick?: (
    photo: ComparisonProgressPhoto,
    label: string,
    weekNumber: number
  ) => void;
  onDeleteWeek?: (logDate: string) => void;
  deletingWeek?: string | null;
};

const photoRows: Array<{ key: ComparisonPhotoType; label: string }> = [
  { key: "front", label: "Front" },
  { key: "back", label: "Back" },
  { key: "side", label: "Side" },
];

export function buildProgressPhotoWeeks(
  photos: ComparisonProgressPhoto[]
): ComparisonPhotoWeek[] {
  const grouped = photos.reduce((acc, photo) => {
    if (!acc[photo.log_date]) {
      acc[photo.log_date] = {
        log_date: photo.log_date,
        week_number: 0,
        front: null,
        back: null,
        side: null,
      };
    }

    acc[photo.log_date][photo.photo_type] = photo;
    return acc;
  }, {} as Record<string, ComparisonPhotoWeek>);

  const weeks = Object.values(grouped).sort((a, b) =>
    a.log_date.localeCompare(b.log_date)
  );

  weeks.forEach((week, index) => {
    week.week_number = index + 1;
  });

  return weeks;
}

function getDaysBetween(fromDate: string, toDate: string) {
  const from = new Date(`${fromDate}T12:00:00`);
  const to = new Date(`${toDate}T12:00:00`);
  return Math.max(
    0,
    Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
  );
}

function formatGapLabel(fromDate: string, toDate: string) {
  const days = getDaysBetween(fromDate, toDate);
  if (days === 0) return "Same day";

  const dayLabel = `${days} day${days === 1 ? "" : "s"}`;
  const weeks = Math.floor(days / 7);
  const remainingDays = days % 7;

  if (weeks === 0) return dayLabel;

  const weekLabel = `${weeks} week${weeks === 1 ? "" : "s"}`;
  const remainderLabel =
    remainingDays > 0
      ? ` ${remainingDays} day${remainingDays === 1 ? "" : "s"}`
      : "";

  return `${dayLabel} (${weekLabel}${remainderLabel})`;
}

function getDisplayedWeeks(photoWeeks: ComparisonPhotoWeek[], showAllWeeks: boolean) {
  if (photoWeeks.length <= 1) return photoWeeks;
  if (showAllWeeks) return photoWeeks;
  return [photoWeeks[0], photoWeeks[photoWeeks.length - 1]];
}

export default function ProgressPhotoComparison({
  photoWeeks,
  showAllWeeks,
  onShowAllWeeksChange,
  getPhotoUrl,
  onPhotoClick,
  onDeleteWeek,
  deletingWeek,
}: Props) {
  const displayedWeeks = getDisplayedWeeks(photoWeeks, showAllWeeks);
  const hiddenSetCount = Math.max(photoWeeks.length - 2, 0);
  const hasHiddenSets = hiddenSetCount > 0;
  const shouldUseScroll = showAllWeeks && photoWeeks.length > 2;

  if (photoWeeks.length === 0) {
    return null;
  }

  const renderPhotoCard = (
    row: (typeof photoRows)[number],
    week: ComparisonPhotoWeek
  ) => {
    const photo = week[row.key];

    return (
      <div className="min-w-0">
        <p className="mb-2 text-xs font-medium text-ink-muted">
          Week {week.week_number} - {week.log_date}
        </p>
        {photo ? (
          <button
            type="button"
            onClick={() => onPhotoClick?.(photo, row.label, week.week_number)}
            className="block w-full overflow-hidden rounded-lg focus:outline-none focus:ring-2 focus:ring-gold"
          >
            <img
              src={getPhotoUrl(photo)}
              alt={`${row.label} progress photo from ${week.log_date}`}
              className="h-44 w-full object-cover transition hover:scale-[1.02] sm:h-52"
            />
          </button>
        ) : (
          <div className="flex h-44 items-center justify-center rounded-lg bg-surface-sunken text-xs text-ink-muted sm:h-52">
            No photo
          </div>
        )}

        {onDeleteWeek && row.key === "front" && (
          <button
            type="button"
            onClick={() => onDeleteWeek(week.log_date)}
            disabled={deletingWeek === week.log_date}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
            title="Delete this photo set"
          >
            <Trash2 size={16} />
            Delete Week {week.week_number}
          </button>
        )}
      </div>
    );
  };

  const renderGap = (
    fromWeek: ComparisonPhotoWeek,
    toWeek: ComparisonPhotoWeek,
    compact = false
  ) => (
    <button
      type="button"
      onClick={() =>
        hasHiddenSets && !showAllWeeks ? onShowAllWeeksChange(true) : undefined
      }
      className={`flex shrink-0 flex-col items-center justify-center gap-1 px-2 text-center ${
        compact ? "w-20 sm:w-28" : "w-28"
      } ${
        hasHiddenSets && !showAllWeeks
          ? "text-gold hover:opacity-80"
          : "text-ink-muted"
      }`}
      title={hasHiddenSets && !showAllWeeks ? "Show all photo sets" : undefined}
    >
      <ChevronRight size={compact ? 24 : 30} />
      <span className="text-[11px] font-semibold sm:text-xs">
        {formatGapLabel(fromWeek.log_date, toWeek.log_date)}
      </span>
      {hasHiddenSets && !showAllWeeks && (
        <span className="text-[10px] text-ink-muted sm:text-[11px]">
          {hiddenSetCount} set{hiddenSetCount === 1 ? "" : "s"} hidden
        </span>
      )}
    </button>
  );

  return (
    <div className="mt-6">
      <div className="space-y-6">
        {photoRows.map((row) => (
          <div key={row.key}>
            <p className="mb-2 text-sm font-semibold text-ink">{row.label}</p>
            {shouldUseScroll ? (
              <div className="overflow-x-auto pb-2">
                <div className="flex min-w-max items-stretch gap-4">
                  {displayedWeeks.map((week, index) => {
                    const nextWeek = displayedWeeks[index + 1];

                    return (
                      <div
                        key={`${row.key}-${week.log_date}`}
                        className="flex items-center gap-4"
                      >
                        <div className="w-56 shrink-0 sm:w-64">
                          {renderPhotoCard(row, week)}
                        </div>
                        {nextWeek && renderGap(week, nextWeek)}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : displayedWeeks.length === 1 ? (
              <div className="max-w-sm">{renderPhotoCard(row, displayedWeeks[0])}</div>
            ) : (
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2 rounded-xl border border-border-subtle bg-surface-raised p-3 sm:gap-4 sm:p-4">
                {renderPhotoCard(row, displayedWeeks[0])}
                {renderGap(displayedWeeks[0], displayedWeeks[1], true)}
                {renderPhotoCard(row, displayedWeeks[1])}
              </div>
            )}
          </div>
        ))}
      </div>

      {showAllWeeks && hasHiddenSets && (
        <button
          type="button"
          onClick={() => onShowAllWeeksChange(false)}
          className="mt-4 text-sm text-gold hover:underline"
        >
          Show only first and latest
        </button>
      )}
    </div>
  );
}
