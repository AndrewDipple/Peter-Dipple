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
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "trainer") {
        router.replace("/client/dashboard");
        return;
      }

      setAllowed(true);
      setChecking(false);
    };

    checkTrainer();
  }, [router]);

  if (checking || !allowed) {
    return (
      <main className={styles.page}>
        <div className={styles.container}>
          <p className={styles.body}>Checking access...</p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}