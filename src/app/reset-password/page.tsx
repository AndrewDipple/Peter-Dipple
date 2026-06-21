"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";
import Image from "next/image";
import Link from "next/link";

type RecoveryStatus = "checking" | "ready" | "invalid";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [recoveryStatus, setRecoveryStatus] =
    useState<RecoveryStatus>("checking");
  const [recoveryError, setRecoveryError] = useState("");

  useEffect(() => {
    let active = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active || !session) return;

      if (
        event === "PASSWORD_RECOVERY" ||
        event === "SIGNED_IN" ||
        event === "INITIAL_SESSION"
      ) {
        setRecoveryStatus("ready");
        setRecoveryError("");
      }
    });

    const initialiseRecoverySession = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const linkError =
        searchParams.get("error_description") ||
        hashParams.get("error_description");

      if (linkError) {
        if (active) {
          setRecoveryStatus("invalid");
          setRecoveryError(linkError.replaceAll("+", " "));
        }
        return;
      }

      // getSession waits for Supabase to exchange a ?code= callback or consume
      // access/refresh tokens from the URL before returning.
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (!active) return;

      if (error || !session) {
        setRecoveryStatus("invalid");
        setRecoveryError(
          "This password reset link is invalid or has expired. Please request a new one."
        );
        return;
      }

      setRecoveryStatus("ready");
      setRecoveryError("");

      if (window.location.search || window.location.hash) {
        window.history.replaceState({}, document.title, "/reset-password");
      }
    };

    void initialiseRecoverySession();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (recoveryStatus !== "ready") {
      alert("Please open a new password reset link from your email");
      return;
    }

    if (!password || password.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    setLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setRecoveryStatus("invalid");
      setRecoveryError(
        "Your password reset session has expired. Please request a new link."
      );
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      alert("Error resetting password: " + error.message);
    } else {
      await supabase.auth.signOut();
      alert("Password updated!");
      window.location.href = "/login";
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-base p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center">
          <Image
            src="/logo-white.png"
            alt="Peter Training and Nutrition"
            width={300}
            height={300}
            className="mb-3"
            priority
          />
          <h1 className={`${styles.display} text-center`}>Reset Password</h1>
        </div>

        <div className={styles.card}>
          {recoveryStatus === "checking" ? (
            <p className={styles.body}>Checking your password reset link...</p>
          ) : recoveryStatus === "invalid" ? (
            <div className="space-y-4">
              <p className="font-semibold text-ink">
                This reset link cannot be used
              </p>
              <p className={styles.bodyLight}>{recoveryError}</p>
              <Link
                href="/login"
                className={`${styles.buttonPrimary} block w-full py-3 text-center`}
              >
                Request a new reset link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-ink">
                  New Password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Enter new password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={styles.input}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-ink">
                  Confirm Password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Enter new password again"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className={styles.input}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`${styles.buttonPrimary} w-full py-3 disabled:opacity-50`}
              >
                {loading ? "Updating..." : "Update Password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
