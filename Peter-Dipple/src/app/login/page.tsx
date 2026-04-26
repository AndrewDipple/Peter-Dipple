"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { styles } from "@/lib/design";

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
    <main className={styles.page}>
      <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow">
        <PageHeader title="Login" />

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-[#111111]">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-[#111111]">Password</label>
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
          className="mt-4 text-sm font-medium text-[#1F6F5E] underline disabled:opacity-50"
        >
          {resetLoading ? "Sending reset email..." : "Forgot password?"}
        </button>
      </div>
    </main>
  );
}