"use client";

import { useEffect, useState } from "react";
import { styles } from "@/lib/design";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type LicenseType = {
  id: string;
  name: string;
};

export default function NewClientPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [licenseTypeId, setLicenseTypeId] = useState("");
  const [licenseTypes, setLicenseTypes] = useState<LicenseType[]>([]);
  const [licenseTypesLoaded, setLicenseTypesLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadLicenseTypes = async () => {
      const { data, error } = await supabase
        .from("license_types")
        .select("id, name")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error) {
        console.warn("Could not load licence types", error);
        setLicenseTypes([]);
      } else {
        setLicenseTypes((data ?? []) as LicenseType[]);
      }

      setLicenseTypesLoaded(true);
    };

    loadLicenseTypes();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || !email.trim()) {
      alert("Please enter name and email");
      return;
    }

    setSaving(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      alert("Please sign in again before inviting a client.");
      setSaving(false);
      return;
    }

    const response = await fetch("/api/invite-client", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fullName: fullName.trim(),
        email: email.trim(),
        licenseTypeId: licenseTypeId || null,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.error || "Error creating client");
      setSaving(false);
      return;
    }

    alert("Client created and invite email sent!");
    setFullName("");
    setEmail("");
    setLicenseTypeId("");
    setSaving(false);
  };

return (
    <>
      <div className="mb-6 flex items-center gap-4">
        <Link href="/trainer/clients" className={styles.buttonSecondary}>
          ← Back
        </Link>
        <h1 className={styles.display}>Add New Client</h1>
      </div>

      <div className="mx-auto max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-ink">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={styles.input}
            />
          </div>

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
            <label className="text-sm font-medium text-ink">Licence type</label>
            <select
              value={licenseTypeId}
              onChange={(e) => setLicenseTypeId(e.target.value)}
              className={styles.input}
              disabled={!licenseTypesLoaded || saving}
            >
              <option value="">
                {licenseTypesLoaded ? "Select licence type" : "Loading licences..."}
              </option>
              {licenseTypes.map((licenseType) => (
                <option key={licenseType.id} value={licenseType.id}>
                  {licenseType.name}
                </option>
              ))}
            </select>
            {licenseTypesLoaded && licenseTypes.length === 0 && (
              <p className="mt-1 text-xs text-ink-muted">
                Run the licensing SQL to enable licence selection.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className={`${styles.buttonPrimary} w-full py-3 disabled:opacity-50`}
          >
            {saving ? "Sending invite..." : "Create Client + Send Invite"}
          </button>
        </form>
      </div>
    </>
  );
}
