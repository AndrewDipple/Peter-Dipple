"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { styles } from "@/lib/design";
import Image from "next/image";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      alert("Login failed");
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile) {
      alert("Profile not found");
      setLoading(false);
      return;
    }

    if (profile.role === "trainer") {
      router.push("/trainer/dashboard");
    } else {
      router.push("/client/dashboard");
    }

    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      alert("Please enter your email address first.");
      return;
    }

    setResetLoading(true);

    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/reset-password`
        : undefined;

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });

    if (error) {
      alert("Error sending password reset email.");
    } else {
      alert("Password reset email sent. Please check your inbox.");
    }

    setResetLoading(false);
  };

return (
    <main className="min-h-screen bg-surface-base flex items-center justify-center p-6">
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
  <h1 className={`${styles.display} text-center`}>Sign in below!</h1>
</div>

        <div className={styles.card}>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-ink">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.input}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-ink">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`${styles.buttonPrimary} w-full py-3 disabled:opacity-50`}
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={resetLoading}
            className="mt-4 text-sm font-medium text-emerald underline disabled:opacity-50"
          >
            {resetLoading ? "Sending reset email..." : "Forgot password?"}
          </button>
        </div>
      </div>
    </main>
  );
}