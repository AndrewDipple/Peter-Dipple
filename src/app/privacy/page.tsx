import { styles } from "@/lib/design";
import BackButton from "@/components/BackButton";

const sections = [
  {
    title: "Who is responsible for your data",
    body: [
      "Peter Dipple / Peter Training is responsible for the personal information used in this coaching app.",
      "The app is used to support fitness, nutrition, progress tracking, client communication, and coaching administration.",
    ],
  },
  {
    title: "What information is collected",
    body: [
      "The app may hold your name, email address, account details, onboarding answers, body measurements, weight logs, training activity, nutrition logs, messages, check-ins, progress photos, goals, milestones, and app feedback.",
      "Some information, such as progress photos, measurements, health goals, and fitness progress, may be sensitive personal data under UK GDPR.",
    ],
  },
  {
    title: "Why the information is used",
    body: [
      "Your information is used to provide coaching, track progress, plan workouts and nutrition, communicate with you, manage your account, keep the app secure, and deal with support, bug reports, or feature requests.",
      "Admin actions such as subject access exports, retention changes, and deletion actions may be logged for accountability.",
    ],
  },
  {
    title: "Progress photos",
    body: [
      "Progress photos are treated as private client data. They are stored in private app storage and are only made available to you and authorised staff through time-limited access links.",
      "Logged-out browsers should not be able to open old progress photo links.",
    ],
  },
  {
    title: "How long information is kept",
    body: [
      "Information is kept while you are an active coaching client. After you leave, records may be kept for up to 12 months for continuity, support, accountability, and record-keeping, unless deletion is requested earlier and no overriding reason requires retention.",
      "Where a deletion request is recorded, the account can be reviewed and deleted using the app's admin deletion process.",
    ],
  },
  {
    title: "Your rights",
    body: [
      "You can ask for a copy of the personal information held about you. This is known as a subject access request.",
      "You can also ask for inaccurate information to be corrected, ask for deletion, object to certain processing, or ask for processing to be restricted. Some rights depend on the circumstances and may not be absolute.",
      "You can raise privacy concerns with Peter Dipple / Peter Training. You also have the right to complain to the Information Commissioner's Office if you are unhappy with how your data is handled.",
    ],
  },
  {
    title: "Sharing and processors",
    body: [
      "The app uses service providers to host and operate the application, including Supabase for database, authentication, and storage, and Netlify for hosting.",
      "Personal information is not sold. It is only shared where needed to operate the app, provide coaching, comply with legal obligations, or protect the security of the service.",
    ],
  },
  {
    title: "Security",
    body: [
      "Access to client records is restricted by account role and row-level security rules. Admin-only tools are used for subject access exports, deletion, retention markers, and audit records.",
      "No system can be guaranteed completely secure, but the app is designed to limit access to the people who need it for coaching or administration.",
    ],
  },
  {
    title: "Contact",
    body: [
      "To request access, correction, deletion, or to ask a privacy question, contact Peter Dipple / Peter Training using your normal coaching contact method.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-surface-base px-4 py-8 md:px-6">
      <div className="mx-auto max-w-4xl">
        <BackButton />

        <div className="mt-6">
          <p className={styles.label}>Privacy notice</p>
          <h1 className={`${styles.display} mt-2`}>Privacy & Data Rights</h1>
          <p className="mt-4 max-w-3xl text-base text-ink-muted">
            This page explains how personal information is used in the Peter Training
            coaching app. It is written to be clear and practical rather than legalistic.
          </p>
          <p className="mt-2 text-sm text-ink-subtle">Last updated: 7 May 2026</p>
        </div>

        <div className="mt-8 space-y-4">
          {sections.map((section) => (
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
