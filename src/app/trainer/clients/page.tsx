"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";

type Client = {
  id: string;
  full_name: string;
  email: string;
  profile_id: string | null;
  last_seen_at: string | null;
  last_sign_in_at: string | null;
  last_active_at: string | null;
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

const getLicenseTypeName = (client: Client) => {
  const licenseType = Array.isArray(client.license_types)
    ? client.license_types[0]
    : client.license_types;
  return licenseType?.name ?? "No licence type";
};

const getLicenseBadge = (client: Client) => {
  const status = client.license_status ?? "active";

  if (["paused", "expired", "cancelled"].includes(status)) {
    return {
      label: status.replaceAll("_", " "),
      className: "border-red-200 bg-red-50 text-red-700",
    };
  }

  if (client.license_expires_on) {
    const daysUntilExpiry = Math.ceil(
      (new Date(`${client.license_expires_on}T12:00:00`).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24)
    );

    if (daysUntilExpiry < 0) {
      return {
        label: "expired date",
        className: "border-red-200 bg-red-50 text-red-700",
      };
    }

    if (daysUntilExpiry <= 14) {
      return {
        label: `expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"}`,
        className: "border-gold bg-gold/10 text-gold",
      };
    }
  }

  return {
    label: status,
    className: "border-emerald/30 bg-emerald/10 text-emerald",
  };
};

export default function TrainerClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadClients = async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, email, profile_id, last_seen_at, license_status, license_expires_on, license_types(name), profiles(last_sign_in_at)")
        .order("full_name", { ascending: true });

      let clientRows: any[] | null = data;
      let clientError = error;

      if (error) {
        const fallback = await supabase
          .from("clients")
          .select("id, full_name, email, profile_id, profiles(last_sign_in_at)")
          .order("full_name", { ascending: true });

        clientRows = fallback.data;
        clientError = fallback.error;
      }

      if (clientError) {
        console.error("clients query failed:", clientError);
        setLoading(false);
        return;
      }

      const flattened: Client[] = (clientRows ?? []).map((c: any) => {
        const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
        return {
          id: c.id,
          full_name: c.full_name,
          email: c.email,
          profile_id: c.profile_id,
          last_seen_at: c.last_seen_at ?? null,
          last_sign_in_at: profile?.last_sign_in_at ?? null,
          last_active_at: c.last_seen_at ?? profile?.last_sign_in_at ?? null,
          license_status: c.license_status ?? null,
          license_expires_on: c.license_expires_on ?? null,
          license_types: c.license_types ?? null,
        };
      });

      setClients(flattened);
      setLoading(false);
    };

    loadClients();
  }, []);

  const getLastActive = (lastActive: string | null) => {
    if (!lastActive) {
      return { text: "No activity recorded", color: "text-red-600" };
    }

    const days = Math.floor(
      (Date.now() - new Date(lastActive).getTime()) / (1000 * 60 * 60 * 24)
    );

    let text: string;
    if (days === 0) text = "Active today";
    else if (days === 1) text = "1 day ago";
    else text = `${days} days ago`;

    let color: string;
    if (days <= 3) color = "text-green-600";
    else if (days <= 7) color = "text-amber-600";
    else color = "text-red-600";

    return { text, color };
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className={styles.display}>Clients</h1>
        <Link href="/trainer/clients/new" className={styles.buttonPrimary}>
          Add Client
        </Link>
      </div>

      {loading ? (
        <p className={styles.body}>Loading clients...</p>
      ) : clients.length === 0 ? (
        <p className={styles.body}>No clients found.</p>
      ) : (
        <div className="space-y-4">
          {clients.map((client) => {
            const { text, color } = getLastActive(client.last_active_at);
            const licenseBadge = getLicenseBadge(client);
            return (
              <Link
                key={client.id}
                href={`/trainer/clients/${client.id}`}
                className="block"
              >
                <div className={styles.cardInteractive}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h2 className={`text-lg font-semibold ${styles.goldText}`}>
                        {client.full_name}
                      </h2>
                      <p className="mt-1 text-sm text-ink-muted">{client.email}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-ink-muted">
                          {getLicenseTypeName(client)}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${licenseBadge.className}`}
                        >
                          {licenseBadge.label}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-medium text-ink-muted">Last Active</p>
                      <p className={`mt-1 text-sm font-semibold ${color}`}>
                        {text}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
