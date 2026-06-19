"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { touchClientLastSeen } from "@/lib/clientActivity";
import { ClientFeaturesContext } from "@/contexts/ClientFeaturesContext";

export default function ClientGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [includesNutrition, setIncludesNutrition] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // Check if user is a client and fetch their licence features
      const { data: clientData } = await supabase
        .from("clients")
        .select("id, license_types(includes_nutrition)")
        .eq("profile_id", user.id)
        .maybeSingle();

      if (!clientData) {
        // User is authenticated but not a client (probably a trainer)
        setLoading(false);
        setAuthorized(false);
        return;
      }

      const licenseType = Array.isArray(clientData.license_types)
        ? clientData.license_types[0]
        : clientData.license_types;
      setIncludesNutrition(licenseType?.includes_nutrition ?? true);

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

  return (
    <ClientFeaturesContext.Provider value={{ includesNutrition }}>
      {children}
    </ClientFeaturesContext.Provider>
  );
}
