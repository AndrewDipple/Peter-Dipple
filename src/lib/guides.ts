export type GuideKey =
  | "welcome"
  | "nutrition"
  | "companions"
  | "workouts"
  | "photo-uploads";

export type Guide = {
  key: GuideKey;
  title: string;
  description: string;
  durationLabel: string;
  fileName: string;
  videoUrl: string;
};

const guideBucket = "app-guides";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const getGuideVideoUrl = (fileName: string) => {
  if (!supabaseUrl) return "";
  return `${supabaseUrl}/storage/v1/object/public/${guideBucket}/${fileName}`;
};

export const guides: Guide[] = [
  {
    key: "welcome",
    title: "Welcome to the app",
    description: "A deeper walkthrough of the app and how Peter uses it for coaching.",
    durationLabel: "Start here",
    fileName: "welcome.mp4",
    videoUrl: getGuideVideoUrl("welcome.mp4"),
  },
  {
    key: "nutrition",
    title: "Nutrition guide",
    description: "How to log meals, use recipes, and keep nutrition tracking useful.",
    durationLabel: "Nutrition",
    fileName: "nutrition.mp4",
    videoUrl: getGuideVideoUrl("nutrition.mp4"),
  },
  {
    key: "workouts",
    title: "Workout guide",
    description: "How to use your programme, log sets, and work around poor signal.",
    durationLabel: "Training",
    fileName: "workouts.mp4",
    videoUrl: getGuideVideoUrl("workouts.mp4"),
  },
  {
    key: "photo-uploads",
    title: "Progress photo guide",
    description: "How to take and upload consistent front, back, and side photos.",
    durationLabel: "Progress",
    fileName: "photo-uploads.mp4",
    videoUrl: getGuideVideoUrl("photo-uploads.mp4"),
  },
  {
    key: "companions",
    title: "Companion guide",
    description: "What companions are, how they grow, and how the collection works.",
    durationLabel: "Optional",
    fileName: "companions.mp4",
    videoUrl: getGuideVideoUrl("companions.mp4"),
  },
];

export const getGuide = (key: string | null | undefined) =>
  guides.find((guide) => guide.key === key) ?? guides[0];
