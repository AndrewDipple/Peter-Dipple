"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";
import { Bell, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

type Notification = {
  id: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  created_at: string;
};

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (data) setNotifications(data);
    setLoading(false);
  };

  const handleMarkAsRead = async (notificationId: string) => {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", notificationId);

    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
  };

  const handleMarkAllAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-ink-muted hover:text-ink"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell size={28} className="text-gold" />
            <div>
              <h1 className={styles.display}>Notifications</h1>
              {unreadCount > 0 && (
                <p className="text-sm text-ink-muted">{unreadCount} unread</p>
              )}
            </div>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className={styles.buttonSecondary}
            >
              Mark all as read
            </button>
          )}
        </div>

        {loading ? (
          <p className={styles.body}>Loading...</p>
        ) : notifications.length === 0 ? (
          <div className={styles.card}>
            <p className="text-center py-12 text-ink-muted">
              No notifications yet
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`rounded-lg border p-4 transition ${
                  notification.read
                    ? "border-border-subtle bg-surface-sunken"
                    : "border-gold bg-gold/5"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-semibold text-ink">{notification.title}</p>
                    <p className="mt-1 text-sm text-ink-muted">
                      {notification.message}
                    </p>
                    <p className="mt-2 text-xs text-ink-muted">
                      {formatTimeAgo(notification.created_at)}
                    </p>
                  </div>

                  {!notification.read && (
                    <button
                      onClick={() => handleMarkAsRead(notification.id)}
                      className="rounded-lg bg-gold px-3 py-1 text-xs font-medium text-ink hover:opacity-90"
                    >
                      Mark read
                    </button>
                  )}
                </div>

{notification.link && (
  <a
    href={notification.link}
    className="mt-3 inline-block text-sm font-medium text-gold hover:underline"
  >
    View →
  </a>
)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}