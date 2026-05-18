"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";
import { notifyClientMessagePush } from "@/lib/clientPush";

type MessageContext = "general" | "workout_day" | "nutrition";

type ClientMessage = {
  id: string;
  sender_role: "client" | "trainer";
  body: string;
  context_label: string | null;
  created_at: string;
};

type MessageTrainerBoxProps = {
  clientId: string;
  contextType: MessageContext;
  contextId?: string | null;
  contextLabel: string;
  anchorId?: string;
  title?: string;
  placeholder?: string;
  accent?: "default" | "workout" | "nutrition";
  showRecentMessages?: boolean;
};

const accentClasses = {
  default: styles.buttonPrimary,
  workout: styles.buttonPrimaryWorkout,
  nutrition: styles.buttonPrimaryNutrition,
};

export default function MessageTrainerBox({
  clientId,
  contextType,
  contextId = null,
  contextLabel,
  anchorId = "message-trainer",
  title = "Message your trainer",
  placeholder = "Ask a question or leave a quick note...",
  accent = "default",
  showRecentMessages = true,
}: MessageTrainerBoxProps) {
  const [body, setBody] = useState("");
  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const loadMessages = async () => {
      setLoading(true);

      let query = supabase
        .from("client_messages")
        .select("id, sender_role, body, context_label, created_at")
        .eq("client_id", clientId)
        .eq("context_type", contextType)
        .order("created_at", { ascending: false })
        .limit(5);

      if (contextId) {
        query = query.eq("context_id", contextId);
      }

      const { data, error } = await query;
      setMessages(!error && data ? data : []);
      setLoading(false);
    };

    loadMessages();
  }, [clientId, contextId, contextType]);

  const handleSend = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;

    setSending(true);

    const { data, error } = await supabase
      .from("client_messages")
      .insert({
        client_id: clientId,
        sender_role: "client",
        context_type: contextType,
        context_id: contextId,
        context_label: contextLabel,
        body: trimmed,
      })
      .select("id, sender_role, body, context_label, created_at")
      .single();

    if (error || !data) {
      alert(error?.message || "Message could not be sent. Please try again.");
      setSending(false);
      return;
    }

    setMessages((prev) => [data, ...prev].slice(0, 5));
    setBody("");
    notifyClientMessagePush(data.id);
    setSending(false);
  };

  return (
    <div id={anchorId} className={`${styles.card} scroll-mt-24`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className={styles.h2}>{title}</h2>
          <p className="mt-1 text-sm text-ink-muted">{contextLabel}</p>
        </div>
      </div>

      <div className="mt-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className={styles.textarea}
          rows={3}
          placeholder={placeholder}
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={sending || body.trim().length === 0}
          className={`${accentClasses[accent]} mt-3 inline-flex items-center gap-2 disabled:opacity-50`}
        >
          <Send size={16} />
          {sending ? "Sending..." : "Send"}
        </button>
      </div>

      {showRecentMessages && (
        <div className="mt-4 space-y-2">
          {loading ? (
            <p className="text-sm text-ink-muted">Loading recent messages...</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-ink-muted">No messages here yet.</p>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className="rounded-lg border border-border-subtle bg-surface-sunken px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                    {message.sender_role === "trainer" ? "Trainer" : "You"}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {new Date(message.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink">
                  {message.body}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
