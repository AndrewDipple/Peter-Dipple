"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AppShell from "@/components/AppShell";
import { Role } from "@/lib/roles";

export default function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRole = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profileRow } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      setRole((profileRow?.role as Role) ?? "client");
      setLoading(false);
    };

    loadRole();
  }, [router]);

  if (loading || !role) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-ink-muted">Loading...</p>
      </div>
    );
  }

  return <AppShell userType={role}>{children}</AppShell>;
}
