"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/PageHeader";
import { styles } from "@/lib/design";

useEffect(() => {
  const checkRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "trainer") {
      window.location.href = "/client/dashboard";
    }
  };

  checkRole();
}, []);

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
    <main className={styles.page}>
      <div className={styles.container}>
        {/* ✅ Header (handles logo, title, layout) */}
<PageHeader title="Clients" showTrainerNav />
        {/* ✅ Content */}
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
                <div className={`${styles.card} hover:bg-[#F2F2F2] transition`}>
<h2 className={`text-lg font-semibold ${styles.goldText}`}>                    {client.full_name}
                  </h2>
                  <p className="mt-1 text-sm text-[#2B2B2B]">
                    {client.email}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}