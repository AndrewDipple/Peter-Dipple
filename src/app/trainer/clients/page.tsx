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
      // First get all clients with their profile_ids
      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select("id, full_name, email, profile_id")
        .order("full_name", { ascending: true });

      if (clientsError || !clientsData) {
        setLoading(false);
        return;
      }

      // Get auth data for all clients
      const clientsWithAuth = await Promise.all(
        clientsData.map(async (client) => {
          if (!client.profile_id) {
            return { ...client, last_sign_in_at: null };
          }

          // Get last sign in from auth.users
          const { data: authData } = await supabase
            .from("profiles")
            .select("last_sign_in_at")
            .eq("id", client.profile_id)
            .single();

          return {
            ...client,
            last_sign_in_at: authData?.last_sign_in_at || null,
          };
        })
      );

      setClients(clientsWithAuth);
      setLoading(false);
    };

    loadClients();
  }, []);

  const getDaysSinceLogin = (lastSignIn: string | null) => {
    if (!lastSignIn) return null;

    const now = new Date();
    const lastLogin = new Date(lastSignIn);
    const diffMs = now.getTime() - lastLogin.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    return diffDays;
  };

  const getLastActiveText = (lastSignIn: string | null) => {
    const days = getDaysSinceLogin(lastSignIn);

    if (days === null) return "Never logged in";
    if (days === 0) return "Active today";
    if (days === 1) return "1 day ago";
    return `${days} days ago`;
  };

  const getLastActiveColor = (lastSignIn: string | null) => {
    const days = getDaysSinceLogin(lastSignIn);

    if (days === null) return "text-red-600";
    if (days === 0) return "text-green-600";
    if (days <= 3) return "text-green-600";
    if (days <= 7) return "text-amber-600";
    return "text-red-600"; // 8+ days
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
          {clients.map((client) => (
            <Link
              key={client.id}
              href={`/trainer/clients/${client.id}`}
              className="block"
            >
              <div className={`${styles.cardInteractive}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h2 className={`text-lg font-semibold ${styles.goldText}`}>
                      {client.full_name}
                    </h2>
                    <p className="mt-1 text-sm text-ink-muted">
                      {client.email}
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-xs font-medium text-ink-muted">Last Active</p>
                    <p className={`mt-1 text-sm font-semibold ${getLastActiveColor(client.last_sign_in_at)}`}>
                      {getLastActiveText(client.last_sign_in_at)}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}