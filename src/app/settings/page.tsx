"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";
import { useTheme } from "@/contexts/ThemeContext";
import { Moon, Sun, User, Mail, Upload, ArrowLeft } from "lucide-react";
import { Role, isStaff } from "@/lib/roles";

type ProfileRecord = {
  id: string;            // row id in whichever table we're editing
  full_name: string | null;
  avatar_url: string | null;
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
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
        .select("id, role, full_name, avatar_url")
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
          avatar_url: profileRow.avatar_url,
        });
        setFullName(profileRow.full_name ?? "");
      } else {
        // Clients edit their clients row, as before.
        const { data: clientData, error: clientErr } = await supabase
          .from("clients")
          .select("id, full_name, avatar_url")
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
          avatar_url: clientData.avatar_url,
        });
        setFullName(clientData.full_name ?? "");
      }

      setLoading(false);
    };

    loadProfile();
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
      flashMessage("success", "Saved!");
    }

    setSaving(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !record || !role) return;

    setUploadingAvatar(true);
    const file = e.target.files[0];
    const ext = file.name.split(".").pop();
    const fileName = `${record.id}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      flashMessage("error", "Upload failed");
      setUploadingAvatar(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("avatars")
      .getPublicUrl(fileName);

    const { error: updateError } = await supabase
      .from(tableForRole(role))
      .update({ avatar_url: publicUrl })
      .eq("id", record.id);

    if (updateError) {
      flashMessage("error", "Failed to save avatar");
      setUploadingAvatar(false);
      return;
    }

    setRecord({ ...record, avatar_url: publicUrl });
    flashMessage("success", "Avatar updated!");
    setUploadingAvatar(false);
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
            {/* Avatar */}
            <div className="flex items-center gap-6">
              <div className="relative">
                {record.avatar_url ? (
                  <img
                    src={record.avatar_url}
                    alt="Avatar"
                    className="h-24 w-24 rounded-full object-cover ring-2 ring-gold"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gold text-2xl font-bold text-ink">
                    {initials}
                  </div>
                )}
                <label
                  htmlFor="avatar"
                  className="absolute bottom-0 right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-gold hover:opacity-90"
                >
                  {uploadingAvatar ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-ink border-t-transparent" />
                  ) : (
                    <Upload size={16} />
                  )}
                </label>
                <input
                  id="avatar"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={uploadingAvatar}
                />
              </div>
              <div>
                <p className="font-semibold">Profile Picture</p>
                <p className="text-sm text-ink-muted">Click icon to upload</p>
              </div>
            </div>

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

        {/* Dark Mode */}

      </div>
    </div>
  );
}