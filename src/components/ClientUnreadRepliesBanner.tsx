"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

export type ClientReplyContext = "general" | "workout_day" | "nutrition";

type TrainerReply = {
  id: string;
  body: string;
  context_type: ClientReplyContext;
  context_label: string | null;
  created_at: string;
};

type ClientUnreadRepliesBannerProps = {
  clientId: string;
  compact?: boolean;
};

const contextHref: Record<ClientReplyContext, string> = {
  general: "/client/dashboard",
  workout_day: "/client/workout",
  nutrition: "/client/nutrition",
};

export default function ClientUnreadRepliesBanner({
  clientId,
  compact = false,
}: ClientUnreadRepliesBannerProps) {
  const [replies, setReplies] = useState<TrainerReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissing, setDismissing] = useState(false);

  const latestReply = replies[0] ?? null;

  const label = useMemo(() => {
    if (!latestReply) return "Trainer reply";
    return latestReply.context_label ||
      (latestReply.context_type === "workout_day"
        ? "Workout"
        : latestReply.context_type === "nutrition"
        ? "Nutrition"
        : "General check-in");
  }, [latestReply]);

  useEffect(() => {
    const loadReplies = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("client_messages")
        .select("id, body, context_type, context_label, created_at")
        .eq("client_id", clientId)
        .eq("sender_role", "trainer")
        .is("read_by_client_at", null)
        .order("created_at", { ascending: false })
        .limit(3);

      setReplies(error || !data ? [] : (data as TrainerReply[]));
      setLoading(false);
    };

    loadReplies();
  }, [clientId]);

  const markRead = async () => {
    if (replies.length === 0) return;

    setDismissing(true);
    const ids = replies.map((reply) => reply.id);

    const { error } = await supabase.rpc("mark_client_trainer_replies_read", {
      message_ids: ids,
    });

    if (!error) setReplies([]);
    setDismissing(false);
  };

  if (loading || replies.length === 0 || !latestReply) return null;

  return (
    <div className="rounded-xl border border-gold bg-gold/10 p-4 shadow-subtle">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold text-ink">
          <MessageCircle size={18} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">
            Your trainer replied{replies.length > 1 ? ` (${replies.length})` : ""}
          </p>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
            {label}
          </p>
          {!compact && (
            <p className="mt-2 line-clamp-2 text-sm text-ink-muted">
              {latestReply.body}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={contextHref[latestReply.context_type] ?? "/client/dashboard"}
              onClick={markRead}
              className="rounded-lg bg-gold px-3 py-2 text-xs font-semibold text-ink hover:bg-gold/90"
            >
              Read reply
            </Link>
            <button
              type="button"
              onClick={markRead}
              disabled={dismissing}
              className="inline-flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-raised px-3 py-2 text-xs font-medium text-ink-muted hover:bg-surface-sunken disabled:opacity-50"
            >
              <X size={14} />
              {dismissing ? "Clearing..." : "Mark read"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

