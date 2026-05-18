"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";
import { isStaff } from "@/lib/roles";
import ClientMessages from "@/components/ClientMessages";
import TrainerClientMessages from "@/components/TrainerClientMessages";

type ClientRow = {
  id: string;
  full_name: string;
  email: string;
};

type ProfileRow = {
  role: string | null;
};

export default function MessagesPage() {
  const searchParams = useSearchParams();
  const requestedClientId = searchParams.get("client");
  const [role, setRole] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPage = async () => {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle<ProfileRow>();

      const userRole = profile?.role ?? "client";
      setRole(userRole);

      if (isStaff(userRole)) {
        const { data: clientRows } = await supabase
          .from("clients")
          .select("id, full_name, email")
          .order("full_name", { ascending: true });

        const rows = (clientRows ?? []) as ClientRow[];
        setClients(rows);
        setSelectedClientId(
          requestedClientId && rows.some((client) => client.id === requestedClientId)
            ? requestedClientId
            : rows[0]?.id ?? ""
        );
      } else {
        const { data: clientRow } = await supabase
          .from("clients")
          .select("id")
          .eq("profile_id", user.id)
          .maybeSingle();

        setClientId(clientRow?.id ?? null);
      }

      setLoading(false);
    };

    loadPage();
  }, [requestedClientId]);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) ?? null,
    [clients, selectedClientId]
  );

  if (loading) {
    return <p className={styles.body}>Loading messages...</p>;
  }

  if (!role) {
    return <p className={styles.body}>Messages unavailable.</p>;
  }

  if (!isStaff(role)) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className={styles.display}>Messages</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Your conversation with Peter.
          </p>
        </div>
        {clientId ? (
          <ClientMessages clientId={clientId} />
        ) : (
          <p className={styles.body}>Client account not found.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className={styles.display}>Messages</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Review client messages and reply.
        </p>
      </div>

      {clients.length === 0 ? (
        <p className={styles.body}>No clients found.</p>
      ) : (
        <>
          <div className={styles.card}>
            <label className="text-sm font-medium text-ink">Client</label>
            <select
              value={selectedClientId}
              onChange={(event) => setSelectedClientId(event.target.value)}
              className={styles.select}
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.full_name} ({client.email})
                </option>
              ))}
            </select>
          </div>

          {selectedClient && (
            <div className="space-y-4">
              <div className={styles.card}>
                <h2 className={styles.h2}>{selectedClient.full_name}</h2>
                <p className="mt-1 text-sm text-ink-muted">
                  {selectedClient.email}
                </p>
              </div>
              <TrainerClientMessages
                clientId={selectedClient.id}
                clientName={selectedClient.full_name}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
