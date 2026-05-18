"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";
import { useTheme } from "@/contexts/ThemeContext";
import { Moon, Sun, User, Mail, Upload, ArrowLeft, Power, Bell } from "lucide-react";
import { Role, isStaff } from "@/lib/roles";
import { MARKETING_CONSENT_VERSION } from "@/lib/legal";
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushStatus,
  type PushStatus,
} from "@/lib/pushNotifications";

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
  marketing_consent_at?: string | null;
  marketing_consent_version?: string | null;

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
  const [marketingConsentAt, setMarketingConsentAt] = useState<string | null>(null);
  const [marketingConsentVersion, setMarketingConsentVersion] = useState<string | null>(null);
  const [savingMarketingConsent, setSavingMarketingConsent] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushStatus>("unsupported");
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const [updatingPush, setUpdatingPush] = useState(false);

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
        const { data: clientData, error: clientErr } = await supabase
          .from("clients")
          .select("id, full_name, marketing_consent_at, marketing_consent_version")
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
          marketing_consent_at: clientData.marketing_consent_at,
          marketing_consent_version: clientData.marketing_consent_version,
        });
        setFullName(clientData.full_name ?? "");
        setMarketingConsentAt(clientData.marketing_consent_at ?? null);
        setMarketingConsentVersion(clientData.marketing_consent_version ?? null);
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

  useEffect(() => {
    getPushStatus()
      .then(setPushStatus)
      .catch(() => setPushStatus("unsupported"));
  }, []);


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
      window.dispatchEvent(new Event("profile:updated"));
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

  const handleMarketingConsentChange = async (enabled: boolean) => {
    if (!record || role !== "client") return;

    setSavingMarketingConsent(true);

    const consentAt = enabled ? new Date().toISOString() : null;
    const consentVersion = enabled ? MARKETING_CONSENT_VERSION : null;

    const { error } = await supabase
      .from("clients")
      .update({
        marketing_consent_at: consentAt,
        marketing_consent_version: consentVersion,
      })
      .eq("id", record.id);

    if (error) {
      flashMessage("error", "Could not update marketing consent");
      setSavingMarketingConsent(false);
      return;
    }

    setMarketingConsentAt(consentAt);
    setMarketingConsentVersion(consentVersion);
    flashMessage(
      "success",
      enabled ? "Marketing consent enabled" : "Marketing consent withdrawn"
    );
    setSavingMarketingConsent(false);
  };

  const handleEnablePush = async () => {
    setUpdatingPush(true);
    setPushMessage(null);
    const result = await enablePushNotifications();
    setPushStatus(result.status);
    setPushMessage(result.message);
    setUpdatingPush(false);
  };

  const handleDisablePush = async () => {
    setUpdatingPush(true);
    setPushMessage(null);
    const result = await disablePushNotifications();
    setPushStatus(result.status);
    setPushMessage(result.message);
    setUpdatingPush(false);
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
          <p className="mt-4">We couldn&apos;t load your account.</p>
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

        {role === "client" && (
          <div className={styles.card}>
            <h2 className={styles.h2}>Marketing consent</h2>
            <p className="mt-2 text-sm text-ink-muted">
              This optional consent allows Peter Training to use progress
              information, testimonials, and/or progress photos for marketing,
              education, or promotional purposes. Reasonable efforts will be made
              to maintain anonymity unless you separately agree to be identified.
            </p>
            <label className="mt-4 flex items-start gap-3 rounded-md border border-border-subtle bg-surface-sunken p-4 text-sm text-ink">
              <input
                type="checkbox"
                checked={Boolean(marketingConsentAt)}
                onChange={(event) =>
                  handleMarketingConsentChange(event.target.checked)
                }
                disabled={savingMarketingConsent}
                className="mt-1 h-4 w-4 shrink-0"
              />
              <span>
                I consent to optional marketing use. I understand I can withdraw
                this consent at any time.
              </span>
            </label>
            <p className="mt-3 text-xs text-ink-muted">
              Status:{" "}
              {marketingConsentAt
                ? `consented on ${new Date(marketingConsentAt).toLocaleDateString(
                    "en-GB"
                  )}`
                : "not consented"}
              {marketingConsentVersion
                ? ` (version ${marketingConsentVersion})`
                : ""}
            </p>
          </div>
        )}

        <div className={styles.card}>
          <h2 className={styles.h2}>Push notifications</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Allow this device to receive app notifications. We will start with
            message alerts once server delivery is connected.
          </p>

          <div className="mt-4 rounded-md border border-border-subtle bg-surface-sunken p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Bell size={18} className="mt-1 text-gold" />
                <div>
                  <p className="text-sm font-semibold text-ink">
                    This device is{" "}
                    {pushStatus === "enabled"
                      ? "enabled"
                      : pushStatus === "blocked"
                      ? "blocked"
                      : "not enabled"}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {pushStatus === "missing_key"
                      ? "A VAPID public key is needed before push can be enabled."
                      : pushStatus === "unsupported"
                      ? "This browser does not support web push notifications."
                      : pushStatus === "blocked"
                      ? "Notifications are blocked in browser settings."
                      : "Push is controlled per device/browser."}
                  </p>
                </div>
              </div>

              {pushStatus === "enabled" ? (
                <button
                  type="button"
                  onClick={handleDisablePush}
                  disabled={updatingPush}
                  className={styles.buttonSecondary}
                >
                  {updatingPush ? "Updating..." : "Turn off"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleEnablePush}
                  disabled={
                    updatingPush ||
                    pushStatus === "unsupported" ||
                    pushStatus === "missing_key" ||
                    pushStatus === "blocked"
                  }
                  className={`${styles.buttonPrimary} disabled:opacity-50`}
                >
                  {updatingPush ? "Enabling..." : "Enable on this device"}
                </button>
              )}
            </div>

            {pushMessage && (
              <p className="mt-3 text-sm font-medium text-ink">{pushMessage}</p>
            )}
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
