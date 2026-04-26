"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");

  const handleReset = async () => {
    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      alert("Error resetting password");
    } else {
      alert("Password updated!");
      window.location.href = "/login";
    }
  };

  return (
    <div className="p-6">
      <h1>Reset Password</h1>

      <input
        type="password"
        placeholder="New password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button onClick={handleReset}>Update Password</button>
    </div>
  );
}