"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";
import { useTheme } from "@/contexts/ThemeContext";
import { Moon, Sun, User, Mail, Bell, Upload, Check, X, ArrowLeft } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: clientData } = await supabase
      .from("clients")
      .select("*")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (clientData) {
      setProfile(clientData);
      setFullName(clientData.full_name || "");
      setEmail(user.email || "");
    }

    setLoading(false);
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);

    const { error } = await supabase
      .from("clients")
      .update({ full_name: fullName })
      .eq("id", profile.id);

    if (error) {
      setMessage({ type: "error", text: "Failed to save" });
    } else {
      setMessage({ type: "success", text: "Saved!" });
      setTimeout(() => setMessage(null), 3000);
    }

    setSaving(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !profile) return;

    setUploadingAvatar(true);
    const file = e.target.files[0];
    const fileName = `${profile.id}-${Date.now()}.${file.name.split(".").pop()}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      setMessage({ type: "error", text: "Upload failed" });
      setUploadingAvatar(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(fileName);

    await supabase
      .from("clients")
      .update({ avatar_url: publicUrl })
      .eq("id", profile.id);

    setProfile({ ...profile, avatar_url: publicUrl });
    setMessage({ type: "success", text: "Avatar updated!" });
    setUploadingAvatar(false);
    setTimeout(() => setMessage(null), 3000);
  };

  if (loading) {
    return <div className="p-6"><p>Loading...</p></div>;
  }

  if (!profile) {
    return (
      <div className="p-6">
        <div className={styles.card}>
          <h2 className={styles.h2}>Profile Not Found</h2>
          <p className="mt-4">No client profile found.</p>
          <button onClick={() => router.push("/client/dashboard")} className={`${styles.buttonPrimary} mt-4`}>
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-ink-muted hover:text-ink">
          <ArrowLeft size={16} /> Back
        </button>

        <h1 className={styles.display}>Settings</h1>

        {message && (
          <div className={`rounded-lg p-4 ${message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
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
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="h-24 w-24 rounded-full object-cover ring-2 ring-gold" />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gold text-2xl font-bold text-ink">
                    {fullName.split(" ").map(n => n[0]).join("").toUpperCase() || "?"}
                  </div>
                )}
                <label htmlFor="avatar" className="absolute bottom-0 right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-gold hover:opacity-90">
                  {uploadingAvatar ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-ink border-t-transparent" /> : <Upload size={16} />}
                </label>
                <input id="avatar" type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
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
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className={styles.input} />
            </div>

            {/* Email */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-1">
                <Mail size={16} /> Email
              </label>
              <input type="email" value={email} disabled className={`${styles.input} opacity-50`} />
              <p className="mt-1 text-xs text-ink-muted">Email cannot be changed here</p>
            </div>

            <button onClick={handleSave} disabled={saving} className={`${styles.buttonPrimary} w-full`}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        {/* Dark Mode */}
        <div className={styles.card}>
          <h2 className={styles.h2}>Appearance</h2>
          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {theme === "dark" ? <Moon size={20} /> : <Sun size={20} />}
              <div>
                <p className="font-semibold">Dark Mode</p>
                <p className="text-sm text-ink-muted">{theme === "dark" ? "Enabled" : "Disabled"}</p>
              </div>
            </div>
            <button onClick={toggleTheme} className={`relative inline-flex h-8 w-14 items-center rounded-full transition ${theme === "dark" ? "bg-gold" : "bg-gray-300"}`}>
              <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition ${theme === "dark" ? "translate-x-7" : "translate-x-1"}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}