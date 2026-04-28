"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";



type Client = {
  id: string;
  full_name: string;
  email: string;
};

export default function TrainerClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadClients = async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, email")
        .order("full_name", { ascending: true });

      if (!error && data) {
        setClients(data);
      }

      setLoading(false);
    };

    loadClients();
  }, []);

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
                <h2 className={`text-lg font-semibold ${styles.goldText}`}>
                  {client.full_name}
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  {client.email}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}