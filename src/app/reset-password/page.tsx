"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!password || password.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      alert("Error resetting password: " + error.message);
    } else {
      alert("Password updated!");
      window.location.href = "/login";
    }
  };

  return (
    <main className="min-h-screen bg-surface-base flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className={`${styles.display} text-center mb-6`}>Reset Password</h1>

        <div className={styles.card}>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-ink">New Password</label>
              <input
                type="password"
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
              />
            </div>

            <button
              onClick={handleReset}
              disabled={loading}
              className={`${styles.buttonPrimary} w-full py-3 disabled:opacity-50`}
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}