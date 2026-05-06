"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";
import {
  MARKETING_CONSENT_VERSION,
  PRIVACY_VERSION,
  TERMS_VERSION,
  hasAcceptedCurrentLegal,
} from "@/lib/legal";

type ClientLegalState = {
  id: string;
  onboarding_complete: boolean | null;
  terms_accepted_at: string | null;
  privacy_accepted_at: string | null;
  health_data_consent_at: string | null;
  terms_version: string | null;
  privacy_version: string | null;
};

export default function ClientTermsAcceptancePage() {
  const router = useRouter();
  const [client, setClient] = useState<ClientLegalState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedHealthData, setAcceptedHealthData] = useState(false);
  const [acceptedMarketing, setAcceptedMarketing] = useState(false);

  const canContinue = useMemo(
    () => acceptedTerms && acceptedPrivacy && acceptedHealthData,
    [acceptedTerms, acceptedPrivacy, acceptedHealthData]
  );

  useEffect(() => {
    const loadClient = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("clients")
        .select(
          "id, onboarding_complete, terms_accepted_at, privacy_accepted_at, health_data_consent_at, terms_version, privacy_version"
        )
        .eq("profile_id", user.id)
        .maybeSingle();

      if (error || !data) {
        setLoading(false);
        return;
      }

      const clientData = data as ClientLegalState;

      if (hasAcceptedCurrentLegal(clientData)) {
        router.replace(
          clientData.onboarding_complete === false
            ? "/onboarding"
            : "/client/dashboard"
        );
        return;
      }

      setClient(clientData);
      setLoading(false);
    };

    loadClient();
  }, [router]);

  const handleAccept = async () => {
    if (!client || !canContinue) return;

    setSaving(true);
    const acceptedAt = new Date().toISOString();

    const { error } = await supabase
      .from("clients")
      .update({
        terms_accepted_at: acceptedAt,
        privacy_accepted_at: acceptedAt,
        health_data_consent_at: acceptedAt,
        terms_version: TERMS_VERSION,
        privacy_version: PRIVACY_VERSION,
        marketing_consent_at: acceptedMarketing ? acceptedAt : null,
        marketing_consent_version: acceptedMarketing
          ? MARKETING_CONSENT_VERSION
          : null,
      })
      .eq("id", client.id);

    if (error) {
      alert("Could not save your acceptance. Please try again.");
      setSaving(false);
      return;
    }

    router.replace(
      client.onboarding_complete === false ? "/onboarding" : "/client/dashboard"
    );
  };

  return (
    <main className="min-h-screen bg-surface-base px-4 py-8 md:px-6">
      <div className="mx-auto max-w-3xl">
        <div className={styles.card}>
          <p className={styles.label}>Before you continue</p>
          <h1 className={`${styles.display} mt-2`}>
            Terms, privacy, and consent
          </h1>
          <p className="mt-4 text-sm leading-6 text-ink-muted">
            Before using the coaching questionnaire, please review and confirm the
            terms, privacy notice, and explicit consent for processing health,
            fitness, measurement, and progress-photo data.
          </p>

          {loading ? (
            <p className="mt-6 text-sm text-ink-muted">Loading...</p>
          ) : !client ? (
            <p className="mt-6 text-sm text-ink-muted">Client account not found.</p>
          ) : (
            <>
              <div className="mt-6 space-y-4">
                <label className="flex gap-3 rounded-md border border-border-subtle bg-surface-sunken p-4 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(event) => setAcceptedTerms(event.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0"
                  />
                  <span>
                    I accept the{" "}
                    <Link href="/terms" className="font-semibold underline">
                      App Terms
                    </Link>
                    .
                  </span>
                </label>

                <label className="flex gap-3 rounded-md border border-border-subtle bg-surface-sunken p-4 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={acceptedPrivacy}
                    onChange={(event) => setAcceptedPrivacy(event.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0"
                  />
                  <span>
                    I have read the{" "}
                    <Link href="/privacy" className="font-semibold underline">
                      Privacy & Data Rights notice
                    </Link>
                    .
                  </span>
                </label>

                <label className="flex gap-3 rounded-md border border-border-subtle bg-surface-sunken p-4 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={acceptedHealthData}
                    onChange={(event) =>
                      setAcceptedHealthData(event.target.checked)
                    }
                    className="mt-1 h-4 w-4 shrink-0"
                  />
                  <span>
                    I explicitly consent to Peter Training processing my health,
                    fitness, measurement, nutrition, workout, and progress-photo
                    information for coaching and app support.
                  </span>
                </label>

                <label className="flex gap-3 rounded-md border border-border-subtle bg-surface-sunken p-4 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={acceptedMarketing}
                    onChange={(event) =>
                      setAcceptedMarketing(event.target.checked)
                    }
                    className="mt-1 h-4 w-4 shrink-0"
                  />
                  <span>
                    Optional: I consent to Peter Training using my progress
                    information, testimonials, and/or progress photos for marketing,
                    education, or promotional purposes. Reasonable efforts will be
                    made to maintain anonymity unless I separately agree to be
                    identified. I understand this is optional and I can withdraw this
                    consent later.
                  </span>
                </label>
              </div>

              <button
                type="button"
                onClick={handleAccept}
                disabled={!canContinue || saving}
                className={`${styles.buttonPrimary} mt-6 w-full`}
              >
                {saving ? "Saving..." : "Accept and continue"}
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
