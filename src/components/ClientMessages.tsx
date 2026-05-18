"use client";

import { useCallback, useEffect, useState } from "react";
import { Send } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";
import { notifyClientMessagePush } from "@/lib/clientPush";

type ClientMessage = {
  id: string;
  sender_role: "client" | "trainer";
  body: string;
  context_type: "general" | "workout_day" | "nutrition";
  context_label: string | null;
  read_by_client_at: string | null;
  created_at: string;
};

type ClientMessagesProps = {
  clientId: string;
};

const contextLabels: Record<ClientMessage["context_type"], string> = {
  general: "General",
  workout_day: "Workout",
  nutrition: "Nutrition",
};

export default function ClientMessages({ clientId }: ClientMessagesProps) {
  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadMessages = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("client_messages")
      .select("id, sender_role, body, context_type, context_label, read_by_client_at, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error || !data) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setMessages(data as ClientMessage[]);

    const unreadTrainerReplyIds = (data as ClientMessage[])
      .filter(
        (message) =>
          message.sender_role === "trainer" && !message.read_by_client_at
      )
      .map((message) => message.id);

    if (unreadTrainerReplyIds.length > 0) {
      await supabase.rpc("mark_client_trainer_replies_read", {
        message_ids: unreadTrainerReplyIds,
      });
    }

    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadMessages();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadMessages]);

  const handleSend = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;

    setSending(true);

    const { data, error } = await supabase
      .from("client_messages")
      .insert({
        client_id: clientId,
        sender_role: "client",
        context_type: "general",
        context_id: null,
        context_label: "General message",
        body: trimmed,
      })
      .select("id, sender_role, body, context_type, context_label, read_by_client_at, created_at")
      .single();

    if (error || !data) {
      alert(error?.message || "Message could not be sent. Please try again.");
      setSending(false);
      return;
    }

    setMessages((prev) => [data as ClientMessage, ...prev]);
    setBody("");
    notifyClientMessagePush(data.id);
    setSending(false);
  };

  return (
    <div className="space-y-4">
      <div className={styles.card}>
        <h2 className={styles.h2}>Message Peter</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Send a general question or update.
        </p>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className={styles.textarea}
          rows={3}
          placeholder="Ask a question or leave a quick update..."
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || body.trim().length === 0}
          className={`${styles.buttonPrimary} mt-3 inline-flex items-center gap-2 disabled:opacity-50`}
        >
          <Send size={16} />
          {sending ? "Sending..." : "Send"}
        </button>
      </div>

      <div className={styles.card}>
        <h2 className={styles.h2}>Conversation</h2>
        <div className="mt-4 space-y-3">
          {loading ? (
            <p className="text-sm text-ink-muted">Loading messages...</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-ink-muted">No messages yet.</p>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className="rounded-lg border border-border-subtle bg-surface-sunken p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-surface-raised px-2.5 py-1 text-xs font-medium text-ink-muted">
                      {contextLabels[message.context_type]}
                    </span>
                    {message.context_label && (
                      <span className="text-xs text-ink-muted">
                        {message.context_label}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-muted">
                    {new Date(message.created_at).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <p className="mt-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
                  {message.sender_role === "trainer" ? "Peter" : "You"}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink">
                  {message.body}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
