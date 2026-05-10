"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { guides, getGuide } from "@/lib/guides";
import { styles } from "@/lib/design";
import { PlayCircle } from "lucide-react";

export default function ClientGuidesPage() {
  const searchParams = useSearchParams();
  const activeGuide = getGuide(searchParams.get("guide"));

  useEffect(() => {
    window.localStorage.setItem(`guide-viewed:${activeGuide.key}`, "true");
    window.dispatchEvent(
      new CustomEvent("guide:viewed", { detail: { guide: activeGuide.key } })
    );
  }, [activeGuide.key]);

  return (
    <div className="space-y-6">
      <div>
        <p className={styles.label}>Peter&apos;s Guides</p>
        <h1 className={`${styles.display} mt-2`}>App Guides</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Short coaching videos from Peter for the parts of the app clients use most.
        </p>
      </div>

      <div className={`${styles.card} overflow-hidden`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-gold">
              {activeGuide.durationLabel}
            </p>
            <h2 className={`${styles.h2} mt-1`}>{activeGuide.title}</h2>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-md border border-border-subtle bg-surface-sunken">
          {activeGuide.videoUrl ? (
            <video
              src={activeGuide.videoUrl}
              controls
              className="aspect-video w-full bg-black"
            />
          ) : (
            <div className="flex aspect-video flex-col items-center justify-center gap-3 p-6 text-center text-ink-muted">
              <PlayCircle size={42} />
              <div>
                <p className="font-semibold text-ink">Video slot ready</p>
                <p className="mt-1 text-sm">
                  Add Peter&apos;s video URL for this guide when it is uploaded.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {guides.map((guide) => {
          const active = guide.key === activeGuide.key;

          return (
            <Link
              key={guide.key}
              href={`/client/guides?guide=${guide.key}`}
              className={`${styles.cardInteractive} block border ${
                active ? "border-gold" : "border-transparent"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-gold">
                {guide.durationLabel}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-ink">{guide.title}</h3>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
