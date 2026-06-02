"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";

type ReviewClient = {
  id: string;
  full_name: string;
  email: string;
  archived_at: string | null;
  deletion_requested_at: string | null;
  delete_after: string | null;
  license_status: string | null;
  license_expires_on: string | null;
  license_types:
    | {
        name: string | null;
      }
    | {
        name: string | null;
      }[]
    | null;
};

type AuditEvent = {
  id: string;
  event_type: string;
  actor_profile_id: string | null;
  target_client_id: string | null;
  target_profile_id: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

type FeedbackItem = {
  id: string;
  user_id: string | null;
  user_name: string | null;
  type: "bug" | "feature" | string;
  title: string;
  description: string;
  page_url: string | null;
  status?: string | null;
  priority?: string | null;
  admin_notes?: string | null;
  created_at: string;
  reviewed_at?: string | null;
  resolved_at?: string | null;
};

const feedbackStatuses = ["new", "reviewing", "planned", "done", "closed"];
const feedbackPriorities = ["low", "normal", "high"];

const formatDate = (date: string | null | undefined) => {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (date: string) =>
  new Date(date).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatEventType = (eventType: string) => {
  const labels: Record<string, string> = {
    sar_exported: "SAR exported",
    retention_started: "Retention started",
    deletion_requested: "Deletion requested",
    retention_cleared: "Retention cleared",
    client_deleted: "Client deleted",
    program_assigned: "Programme assigned",
    program_restored: "Programme restored",
  };

  return labels[eventType] ?? eventType.replaceAll("_", " ");
};

export default function AdminReviewPage() {
  const [clients, setClients] = useState<ReviewClient[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [feedbackFilter, setFeedbackFilter] = useState<"all" | "feature" | "bug">(
    "all"
  );
  const [feedbackSavingId, setFeedbackSavingId] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadReview = async () => {
      setLoading(true);

      const [clientResult, auditResult, feedbackResult] = await Promise.all([
        supabase
          .from("clients")
          .select(
            "id, full_name, email, archived_at, deletion_requested_at, delete_after, license_status, license_expires_on, license_types(name)"
          )
          .order("delete_after", { ascending: true, nullsFirst: false }),
        supabase
          .from("admin_audit_events")
          .select(
            "id, event_type, actor_profile_id, target_client_id, target_profile_id, created_at, metadata"
          )
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("feedback")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      setClients((clientResult.data ?? []) as ReviewClient[]);
      setAuditEvents((auditResult.data ?? []) as AuditEvent[]);
      if (feedbackResult.error) {
        setFeedbackError("Feedback could not be loaded.");
      } else {
        setFeedbackItems((feedbackResult.data ?? []) as FeedbackItem[]);
      }
      setLoading(false);
    };

    loadReview();
  }, []);

  const now = useMemo(() => new Date(), []);

  const deletionRequests = clients.filter((client) => client.deletion_requested_at);
  const dueForReview = clients.filter(
    (client) => client.delete_after && new Date(client.delete_after) <= now
  );
  const upcomingReviews = clients
    .filter((client) => client.delete_after && new Date(client.delete_after) > now)
    .slice(0, 10);
  const featureRequests = feedbackItems.filter((item) => item.type === "feature");
  const bugReports = feedbackItems.filter((item) => item.type === "bug");
  const openFeedback = feedbackItems.filter(
    (item) => !["done", "closed"].includes(item.status ?? "new")
  );
  const licenseWatchList = clients.filter((client) => {
    if (client.license_status && !["active", "trial"].includes(client.license_status)) {
      return true;
    }

    if (!client.license_expires_on) return false;
    const daysUntilExpiry = Math.ceil(
      (new Date(client.license_expires_on).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24)
    );
    return daysUntilExpiry <= 14;
  });
  const filteredFeedback = feedbackItems.filter((item) =>
    feedbackFilter === "all" ? true : item.type === feedbackFilter
  );

  const updateFeedback = async (
    item: FeedbackItem,
    updates: Partial<FeedbackItem>
  ) => {
    setFeedbackSavingId(item.id);
    setFeedbackError("");

    const nextStatus = updates.status ?? item.status ?? "new";
    const resolvedStatus = ["done", "closed"].includes(nextStatus);
    const payload = {
      ...updates,
      reviewed_at: new Date().toISOString(),
      resolved_at: resolvedStatus ? new Date().toISOString() : null,
    };

    const { error } = await supabase
      .from("feedback")
      .update(payload)
      .eq("id", item.id);

    if (error) {
      setFeedbackError(
        "Could not update feedback. Run the feedback admin SQL patch if this is the first time using these controls."
      );
      setFeedbackSavingId(null);
      return;
    }

    setFeedbackItems((prev) =>
      prev.map((feedback) =>
        feedback.id === item.id ? { ...feedback, ...payload } : feedback
      )
    );
    setFeedbackSavingId(null);
  };

  const renderClientList = (items: ReviewClient[], emptyText: string) => {
    if (items.length === 0) {
      return <p className="text-sm text-ink-muted">{emptyText}</p>;
    }

    return (
      <div className="space-y-2">
        {items.map((client) => (
          <Link
            key={client.id}
            href={`/trainer/clients/${client.id}`}
            className="block rounded-md border border-border-subtle bg-surface-sunken p-3 transition hover:bg-surface-raised"
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold text-ink">{client.full_name}</p>
                <p className="text-sm text-ink-muted">{client.email}</p>
              </div>
              <div className="text-sm text-ink-muted md:text-right">
                <p>Requested: {formatDate(client.deletion_requested_at)}</p>
                <p>Delete/review: {formatDate(client.delete_after)}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    );
  };

  const getLicenseTypeName = (client: ReviewClient) => {
    const licenseType = Array.isArray(client.license_types)
      ? client.license_types[0]
      : client.license_types;
    return licenseType?.name ?? "No licence type";
  };

  return (
    <div className="space-y-6">
      <div>
        <p className={styles.label}>Admin</p>
        <h1 className={`${styles.display} mt-2`}>Review List</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Deletion requests, retention reviews, and recent GDPR/admin activity.
        </p>
      </div>

      {loading ? (
        <p className={styles.body}>Loading admin review...</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <div className={styles.card}>
              <p className={styles.label}>Deletion requests</p>
              <p className="mt-2 text-3xl font-bold text-ink">
                {deletionRequests.length}
              </p>
            </div>
            <div className={styles.card}>
              <p className={styles.label}>Due now</p>
              <p className="mt-2 text-3xl font-bold text-ink">
                {dueForReview.length}
              </p>
            </div>
            <div className={styles.card}>
              <p className={styles.label}>Open feedback</p>
              <p className="mt-2 text-3xl font-bold text-ink">
                {openFeedback.length}
              </p>
            </div>
          </div>

          <section className={styles.card}>
            <h2 className={styles.h2}>Licence watch list</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Clients with paused/expired/cancelled licences, or licences expiring
              within 14 days.
            </p>
            <div className="mt-4 space-y-2">
              {licenseWatchList.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  No licence reviews needed right now.
                </p>
              ) : (
                licenseWatchList.map((client) => (
                  <Link
                    key={client.id}
                    href={`/trainer/clients/${client.id}`}
                    className="block rounded-md border border-border-subtle bg-surface-sunken p-3 transition hover:bg-surface-raised"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-semibold text-ink">{client.full_name}</p>
                        <p className="text-sm text-ink-muted">
                          {getLicenseTypeName(client)}
                        </p>
                      </div>
                      <div className="text-sm text-ink-muted md:text-right">
                        <p>Status: {client.license_status ?? "active"}</p>
                        <p>Expires: {formatDate(client.license_expires_on)}</p>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>

          <section className={styles.card}>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className={styles.h2}>Feature requests and bugs</h2>
                <p className="mt-1 text-sm text-ink-muted">
                  {featureRequests.length} feature requests, {bugReports.length} bug reports
                </p>
              </div>

              <div className="flex rounded-md border border-border-subtle bg-surface-sunken p-1">
                {(["all", "feature", "bug"] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setFeedbackFilter(filter)}
                    className={`rounded px-3 py-1.5 text-sm font-medium ${
                      feedbackFilter === filter
                        ? "bg-surface-raised text-ink shadow-sm"
                        : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    {filter === "all"
                      ? "All"
                      : filter === "feature"
                        ? "Features"
                        : "Bugs"}
                  </button>
                ))}
              </div>
            </div>

            {feedbackError && (
              <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {feedbackError}
              </p>
            )}

            <div className="mt-4 space-y-3">
              {filteredFeedback.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  No feedback has been submitted yet.
                </p>
              ) : (
                filteredFeedback.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-md border border-border-subtle bg-surface-sunken p-3"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded bg-surface-raised px-2 py-0.5 text-xs font-semibold uppercase text-ink-muted">
                            {item.type === "feature" ? "Feature" : "Bug"}
                          </span>
                          <span className="rounded bg-surface-raised px-2 py-0.5 text-xs font-medium text-ink-muted">
                            {item.status ?? "new"}
                          </span>
                          <span className="text-xs text-ink-muted">
                            {formatDateTime(item.created_at)}
                          </span>
                        </div>

                        <p className="mt-2 font-semibold text-ink">{item.title}</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-ink-muted">
                          {item.description}
                        </p>
                        <p className="mt-2 text-xs text-ink-muted">
                          From: {item.user_name || "Anonymous"}
                        </p>
                        {item.page_url && (
                          <a
                            href={item.page_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 block break-all text-xs text-gold hover:underline"
                          >
                            {item.page_url}
                          </a>
                        )}
                      </div>

                      <div className="grid gap-2 md:w-56">
                        <select
                          value={item.status ?? "new"}
                          onChange={(event) =>
                            updateFeedback(item, { status: event.target.value })
                          }
                          disabled={feedbackSavingId === item.id}
                          className={styles.input}
                        >
                          {feedbackStatuses.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>

                        <select
                          value={item.priority ?? "normal"}
                          onChange={(event) =>
                            updateFeedback(item, { priority: event.target.value })
                          }
                          disabled={feedbackSavingId === item.id}
                          className={styles.input}
                        >
                          {feedbackPriorities.map((priority) => (
                            <option key={priority} value={priority}>
                              {priority}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <textarea
                      value={item.admin_notes ?? ""}
                      onChange={(event) =>
                        setFeedbackItems((prev) =>
                          prev.map((feedback) =>
                            feedback.id === item.id
                              ? { ...feedback, admin_notes: event.target.value }
                              : feedback
                          )
                        )
                      }
                      onBlur={(event) =>
                        updateFeedback(item, { admin_notes: event.target.value })
                      }
                      placeholder="Admin notes"
                      rows={2}
                      className={`${styles.input} mt-3`}
                    />
                  </div>
                ))
              )}
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.h2}>Deletion requests</h2>
            <div className="mt-4">
              {renderClientList(deletionRequests, "No deletion requests recorded.")}
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.h2}>Due for deletion/review</h2>
            <div className="mt-4">
              {renderClientList(dueForReview, "No clients are due for review.")}
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.h2}>Upcoming retention reviews</h2>
            <div className="mt-4">
              {renderClientList(upcomingReviews, "No upcoming retention reviews.")}
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.h2}>Recent admin actions</h2>
            <div className="mt-4 space-y-2">
              {auditEvents.length === 0 ? (
                <p className="text-sm text-ink-muted">No audit events recorded.</p>
              ) : (
                auditEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-md border border-border-subtle bg-surface-sunken p-3"
                  >
                    <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <p className="font-semibold text-ink">
                        {formatEventType(event.event_type)}
                      </p>
                      <p className="text-sm text-ink-muted">
                        {formatDateTime(event.created_at)}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-ink-muted">
                      Target client: {event.target_client_id ?? "-"}
                    </p>
                    {typeof event.metadata?.note === "string" &&
                      event.metadata.note && (
                        <p className="mt-1 text-xs text-ink-muted">
                          Note: {event.metadata.note}
                        </p>
                      )}
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
