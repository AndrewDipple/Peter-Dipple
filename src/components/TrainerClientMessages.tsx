"use client";

import { useEffect, useMemo, useState } from "react";
import { Send } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";

type ClientMessage = {
  id: string;
  client_id: string;
  sender_role: "client" | "trainer";
  body: string;
  context_type: "general" | "workout_day" | "nutrition";
  context_id: string | null;
  context_label: string | null;
  parent_message_id: string | null;
  read_by_trainer_at: string | null;
  created_at: string;
};

type TrainerClientMessagesProps = {
  clientId: string;
};

const contextLabels: Record<ClientMessage["context_type"], string> = {
  general: "General",
  workout_day: "Workout",
  nutrition: "Nutrition",
};

export default function TrainerClientMessages({
  clientId,
}: TrainerClientMessagesProps) {
  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [sendingReplyId, setSendingReplyId] = useState<string | null>(null);

  const unreadCount = useMemo(
    () =>
      messages.filter(
        (message) =>
          message.sender_role === "client" && !message.read_by_trainer_at
      ).length,
    [messages]
  );

  const loadMessages = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("client_messages")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error || !data) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setMessages(data);

    const unreadClientMessageIds = data
      .filter(
        (message) =>
          message.sender_role === "client" && !message.read_by_trainer_at
      )
      .map((message) => message.id);

    if (unreadClientMessageIds.length > 0) {
      const readAt = new Date().toISOString();
      await supabase
        .from("client_messages")
        .update({ read_by_trainer_at: readAt })
        .in("id", unreadClientMessageIds);

      setMessages((prev) =>
        prev.map((message) =>
          unreadClientMessageIds.includes(message.id)
            ? { ...message, read_by_trainer_at: readAt }
            : message
        )
      );
    }

    setLoading(false);
  };

  useEffect(() => {
    loadMessages();
  }, [clientId]);

  const handleReply = async (message: ClientMessage) => {
    const draft = replyDrafts[message.id]?.trim();
    if (!draft) return;

    setSendingReplyId(message.id);

    const { data, error } = await supabase
      .from("client_messages")
      .insert({
        client_id: clientId,
        sender_role: "trainer",
        body: draft,
        context_type: message.context_type,
        context_id: message.context_id,
        context_label: message.context_label,
        parent_message_id: message.id,
      })
      .select()
      .single();

    if (error || !data) {
      alert("Reply could not be sent. Please try again.");
      setSendingReplyId(null);
      return;
    }

    setMessages((prev) => [data, ...prev]);
    setReplyDrafts((prev) => ({ ...prev, [message.id]: "" }));
    setSendingReplyId(null);
  };

  return (
    <div className={styles.card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-ink">Client Messages</h3>
          <p className="mt-1 text-sm text-ink-muted">
            Notes and questions from this client
          </p>
        </div>

        {unreadCount > 0 && (
          <span className="rounded-full bg-gold px-3 py-1 text-xs font-semibold text-ink">
            {unreadCount} unread
          </span>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          <p className="text-sm text-ink-muted">Loading messages...</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-ink-muted">No messages from this client yet.</p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className="rounded-xl border border-border-subtle bg-surface-sunken p-4"
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
                {message.sender_role === "trainer" ? "Trainer reply" : "Client"}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink">
                {message.body}
              </p>

              {message.sender_role === "client" && (
                <div className="mt-3">
                  <textarea
                    value={replyDrafts[message.id] ?? ""}
                    onChange={(e) =>
                      setReplyDrafts((prev) => ({
                        ...prev,
                        [message.id]: e.target.value,
                      }))
                    }
                    className={styles.textarea}
                    rows={2}
                    placeholder="Reply to this message..."
                  />
                  <button
                    type="button"
                    onClick={() => handleReply(message)}
                    disabled={
                      sendingReplyId === message.id ||
                      !replyDrafts[message.id]?.trim()
                    }
                    className={`${styles.buttonPrimary} mt-2 inline-flex items-center gap-2 disabled:opacity-50`}
                  >
                    <Send size={16} />
                    {sendingReplyId === message.id ? "Sending..." : "Reply"}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
