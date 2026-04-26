"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!password || !confirmPassword) {
      alert("Please fill in both fields");
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      alert("Error updating password");
      setLoading(false);
      return;
    }

    alert("Password set successfully!");
    router.push("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow">
        <h1 className="text-2xl font-bold">Create your password</h1>

        <div className="mt-6 space-y-4">
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border px-3 py-2"
          />

          <input
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-xl border px-3 py-2"
          />

          <button
            onClick={handleReset}
            disabled={loading}
            className="w-full rounded-xl bg-black px-4 py-3 text-white"
          >
            {loading ? "Saving..." : "Set Password"}
          </button>
        </div>
      </div>
    </div>
  );
}