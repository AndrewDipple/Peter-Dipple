"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PlayCircle } from "lucide-react";
import type { GuideKey } from "@/lib/guides";

type GuideLinkProps = {
  guide: GuideKey;
  label?: string;
  className?: string;
};

export default function GuideLink({
  guide,
  label = "Peter's guide",
  className = "",
}: GuideLinkProps) {
  const [viewed, setViewed] = useState(true);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setViewed(window.localStorage.getItem(`guide-viewed:${guide}`) === "true");
    }, 0);

    const handleViewed = (event: Event) => {
      const customEvent = event as CustomEvent<{ guide: GuideKey }>;
      if (customEvent.detail?.guide === guide) {
        setViewed(true);
      }
    };

    window.addEventListener("guide:viewed", handleViewed);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("guide:viewed", handleViewed);
    };
  }, [guide]);

  return (
    <Link
      href={`/client/guides?guide=${guide}`}
      className={`relative inline-flex items-center gap-2 rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-sm font-medium text-ink transition hover:bg-surface-sunken ${className}`}
    >
      {!viewed && (
        <span
          className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-surface-raised"
          aria-label="Unwatched guide"
        />
      )}
      <PlayCircle size={16} />
      {label}
    </Link>
  );
}
