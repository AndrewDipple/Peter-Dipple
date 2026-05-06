"use client";

import { useRouter } from "next/navigation";
import { styles } from "@/lib/design";

type BackButtonProps = {
  fallbackHref?: string;
  label?: string;
};

export default function BackButton({
  fallbackHref = "/login",
  label = "Back",
}: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  };

  return (
    <button type="button" onClick={handleBack} className={styles.buttonSecondary}>
      {label}
    </button>
  );
}
