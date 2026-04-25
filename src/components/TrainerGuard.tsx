"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";

export default function TrainerGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkTrainer = async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.replace("/login");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          console.error("Trainer guard profile error:", profileError);
          router.replace("/login");
          return;
        }

        if (profile?.role !== "trainer") {
          router.replace("/client/dashboard");
          return;
        }

        setAllowed(true);
      } catch (error) {
        console.error("Trainer guard error:", error);
        router.replace("/login");
      } finally {
        setChecking(false);
      }
    };

    checkTrainer();
  }, [router]);

  if (checking) {
    return (
      <main className={styles.page}>
        <div className={styles.container}>
          <p className={styles.body}>Checking trainer access...</p>
        </div>
      </main>
    );
  }

  if (!allowed) return null;

  return <>{children}</>;
}