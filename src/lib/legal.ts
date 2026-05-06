export const TERMS_VERSION = "2026-05-07";
export const PRIVACY_VERSION = "2026-05-07";
export const MARKETING_CONSENT_VERSION = "2026-05-07";

export const termsSections = [
  {
    title: "Coaching support",
    body: [
      "The app supports Peter Training coaching by helping track workouts, nutrition, progress, messages, check-ins, and related coaching activity.",
      "The app is not a substitute for medical advice, diagnosis, or treatment. You should speak to a qualified medical professional before starting or changing exercise or nutrition if you have a health concern, injury, condition, or medication that may be affected.",
    ],
  },
  {
    title: "Your responsibilities",
    body: [
      "You are responsible for entering accurate information and for telling Peter about relevant health, injury, or wellbeing changes that may affect your coaching.",
      "You should stop exercising and seek appropriate help if you feel unwell, experience pain, or have symptoms that concern you.",
    ],
  },
  {
    title: "Account access",
    body: [
      "Keep your login details private. Tell Peter promptly if you think someone else may have access to your account.",
      "The app is intended for your own coaching account and should not be shared with other people.",
    ],
  },
  {
    title: "Progress data and photos",
    body: [
      "You may choose to upload progress photos and enter measurements, weight, nutrition, and training information. These can be sensitive and should only be uploaded if you are comfortable using them for coaching.",
      "Progress photos are stored privately and are only made available to you and authorised staff through time-limited access links.",
    ],
  },
  {
    title: "Availability and changes",
    body: [
      "The app may change over time as features are added, improved, or removed. Reasonable care is taken to keep the app available, but uninterrupted access cannot be guaranteed.",
      "If these terms or the privacy notice materially change, you may be asked to review and accept the updated version.",
    ],
  },
  {
    title: "Data rights",
    body: [
      "Your privacy and data rights are explained in the Privacy & Data Rights notice. That notice explains what data is collected, why it is used, retention periods, SARs, deletion requests, and security controls.",
    ],
  },
];

export const hasAcceptedCurrentLegal = (client: {
  terms_accepted_at?: string | null;
  privacy_accepted_at?: string | null;
  health_data_consent_at?: string | null;
  terms_version?: string | null;
  privacy_version?: string | null;
}) =>
  Boolean(
    client.terms_accepted_at &&
      client.privacy_accepted_at &&
      client.health_data_consent_at &&
      client.terms_version === TERMS_VERSION &&
      client.privacy_version === PRIVACY_VERSION
  );
