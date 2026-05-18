"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { touchClientLastSeen } from "@/lib/clientActivity";

export default function ClientGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // Check if user is a client
      const { data: clientData } = await supabase
        .from("clients")
        .select("id")
        .eq("profile_id", user.id)
        .maybeSingle();

      if (!clientData) {
        // User is authenticated but not a client (probably a trainer)
        setLoading(false);
        setAuthorized(false);
        return;
      }

      setAuthorized(true);
      setLoading(false);
      touchClientLastSeen();
    };

    checkAuth();
  }, [router]);

  useEffect(() => {
    if (!authorized) return;

    const touchOnFocus = () => {
      if (document.visibilityState === "visible") {
        touchClientLastSeen();
      }
    };

    window.addEventListener("focus", touchClientLastSeen);
    document.addEventListener("visibilitychange", touchOnFocus);

    return () => {
      window.removeEventListener("focus", touchClientLastSeen);
      document.removeEventListener("visibilitychange", touchOnFocus);
    };
  }, [authorized]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-ink-muted">Loading...</p>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-ink-muted">Access denied</p>
      </div>
    );
  }

  return <>{children}</>;
}
