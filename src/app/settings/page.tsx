"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";
import { useTheme } from "@/contexts/ThemeContext";
import { Moon, Sun, User, Mail, Upload, ArrowLeft, Power } from "lucide-react";
import { Role, isStaff } from "@/lib/roles";

import {
  getActiveCompanionView,
  listAvailablePaths,
  chooseCompanion,
  renameCompanion,
  deactivateCompanion,
  getRandomLine,
  getRecentCompanionEvents,
  isCompanionEnabledForClient,
  findClientCompanionForPath,
    awardBondXp, // ← add this

  type ActiveCompanionView,
  type CompanionPath,
  type CompanionEvent,
} from "@/lib/companions";

type ProfileRecord = {
  id: string;            // row id in whichever table we're editing
  full_name: string | null;

};


export default function SettingsPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role | null>(null);
  const [record, setRecord] = useState<ProfileRecord | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const [availablePaths, setAvailablePaths] = useState<CompanionPath[]>([]);

    const [view, setView] = useState<ActiveCompanionView | null>(null);

  // Which table we read/write depends on role.
  // Clients edit their `clients` row; trainers and admins edit their `profiles` row directly.
  const tableForRole = (r: Role) => (r === "client" ? "clients" : "profiles");

  
  
  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setEmail(user.email ?? "");

      // Look up role from profiles first.
      const { data: profileRow, error: profileErr } = await supabase
        .from("profiles")
        .select("id, role, full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (profileErr || !profileRow) {
        console.error("profile lookup failed:", profileErr);
        setLoading(false);
        return;
      }

      const userRole = profileRow.role as Role;
      setRole(userRole);

      if (isStaff(userRole)) {
        // Trainers and admins edit the profiles row directly.
        setRecord({
          id: profileRow.id,
          full_name: profileRow.full_name,
        });
        setFullName(profileRow.full_name ?? "");
      } else {
        // Clients edit their clients row, as before.
               console.log("Settings page client lookup. user.id =", user.id);

        const { data: clientData, error: clientErr } = await supabase
          .from("clients")
          .select("id, full_name")
          .eq("profile_id", user.id)
          .maybeSingle();

        if (clientErr || !clientData) {
          console.error("client lookup failed:", clientErr);
          setLoading(false);
          return;
        }

        setRecord({
          id: clientData.id,
          full_name: clientData.full_name,
        });
        setFullName(clientData.full_name ?? "");
      }

      setLoading(false);
    };

    loadProfile();
  }, []);


   const loadPage = useCallback(async () => {
     setLoading(true);
 
     const { data: { user } } = await supabase.auth.getUser();
     if (!user) {
       router.replace("/login");
       return;
     }
 
     const { data: clientData } = await supabase
       .from("clients")
       .select("id")
       .eq("profile_id", user.id)
       .maybeSingle();
 
     if (!clientData) {
       setLoading(false);
       return;
     }
 

 
     // Load active companion (if any) and available paths in parallel.
     const [v, paths] = await Promise.all([
       getActiveCompanionView(clientData.id),
       listAvailablePaths(),
     ]);
 
     setView(v);
     setAvailablePaths(paths);
 

 
     setLoading(false);
   }, [router]);
 
   useEffect(() => {
     loadPage();
   }, [loadPage]); 


  const flashMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSave = async () => {
    if (!record || !role) return;
    setSaving(true);

    const { error } = await supabase
      .from(tableForRole(role))
      .update({ full_name: fullName })
      .eq("id", record.id);

    if (error) {
      flashMessage("error", "Failed to save");
    } else {
      flashMessage("success", "Saved!");
    }

    setSaving(false);
  };

  // --- Turn off ---

  const handleTurnOff = async () => {
    if (!view) return;
    if (!window.confirm(
      "Turn off your companion? Your XP is saved — you can re-activate any time."
    )) return;

    const ok = await deactivateCompanion(view.companion.id);
    if (!ok) {
      alert("Could not turn off companion.");
      return;
    }

    await loadPage();
  };


  if (loading) {
    return <div className="p-6"><p>Loading...</p></div>;
  }

  if (!record || !role) {
    const homePath = isStaff(role) ? "/trainer/dashboard" : "/client/dashboard";

    return (
      <div className="p-6">
        <div className={styles.card}>
          <h2 className={styles.h2}>Profile Not Found</h2>
          <p className="mt-4">We couldn't load your account.</p>
          <button
            onClick={() => router.push(homePath)}
            className={`${styles.buttonPrimary} mt-4`}
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const initials =
    fullName.split(" ").map(n => n[0]).join("").toUpperCase() || "?";

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-ink-muted hover:text-ink"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <h1 className={styles.display}>Settings</h1>

        {message && (
          <div
            className={`rounded-lg p-4 ${
              message.type === "success"
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Profile */}
        <div className={styles.card}>
          <h2 className={styles.h2}>Profile</h2>
          <div className="mt-6 space-y-6">


            {/* Name */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-1">
                <User size={16} /> Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className={styles.input}
              />
            </div>

            {/* Email */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-1">
                <Mail size={16} /> Email
              </label>
              <input
                type="email"
                value={email}
                disabled
                className={`${styles.input} opacity-50`}
              />
              <p className="mt-1 text-xs text-ink-muted">
                Email cannot be changed here
              </p>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className={`${styles.buttonPrimary} w-full`}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

          <div className={styles.card}>
            <h3 className="font-semibold text-ink">Companion settings</h3>
            <p className="mt-1 text-sm text-ink-muted">
              You can turn off your companion at any time. Your progress is saved
              and you can resume later from the Nutrition page.
            </p>
            <button
              onClick={handleTurnOff}
              className="mt-4 flex items-center gap-2 rounded-xl border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <Power size={14} />
              Turn off companion
            </button>
          </div>

{role === "client" && (
  <button
    onClick={async () => {
      if (!record) return;
      await supabase
        .from("clients")
        .update({ tour_completed_at: null })
        .eq("id", record.id);
      router.push("/client/dashboard");
    }}
    className="text-sm font-medium text-emerald hover:underline"
  >
    Take the tour again
  </button>
)}

        {/* Dark Mode */}

      </div>
    </div>
  );
}