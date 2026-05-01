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
  last_sign_in_at: string | null;
};

export default function TrainerClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadClients = async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, email, profile_id, profiles(last_sign_in_at)")
        .order("full_name", { ascending: true });

      if (error) {
        console.error("clients query failed:", error);
        setLoading(false);
        return;
      }

      const flattened: Client[] = (data ?? []).map((c: any) => ({
        id: c.id,
        full_name: c.full_name,
        email: c.email,
        profile_id: c.profile_id,
        last_sign_in_at: c.profiles?.last_sign_in_at ?? null,
      }));

      setClients(flattened);
      setLoading(false);
    };

    loadClients();
  }, []);

  const getLastActive = (lastSignIn: string | null) => {
    if (!lastSignIn) {
      return { text: "Never logged in", color: "text-red-600" };
    }

    const days = Math.floor(
      (Date.now() - new Date(lastSignIn).getTime()) / (1000 * 60 * 60 * 24)
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
            const { text, color } = getLastActive(client.last_sign_in_at);
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