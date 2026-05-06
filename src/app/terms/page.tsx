import { styles } from "@/lib/design";
import { TERMS_VERSION, termsSections } from "@/lib/legal";
import BackButton from "@/components/BackButton";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-surface-base px-4 py-8 md:px-6">
      <div className="mx-auto max-w-4xl">
        <BackButton />

        <div className="mt-6">
          <p className={styles.label}>Terms and conditions</p>
          <h1 className={`${styles.display} mt-2`}>App Terms</h1>
          <p className="mt-4 max-w-3xl text-base text-ink-muted">
            These terms explain the basic expectations for using the Peter Training
            coaching app.
          </p>
          <p className="mt-2 text-sm text-ink-subtle">
            Version: {TERMS_VERSION}
          </p>
        </div>

        <div className="mt-8 space-y-4">
          {termsSections.map((section) => (
            <section key={section.title} className={styles.card}>
              <h2 className={styles.h2}>{section.title}</h2>
              <div className="mt-3 space-y-3">
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-6 text-ink-muted">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
