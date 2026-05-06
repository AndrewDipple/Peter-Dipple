"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getProgressPhotoPath, withSignedProgressPhotoUrls } from "@/lib/privateStorage";
import { styles } from "@/lib/design";
import { awardBondXp } from "@/lib/companions";
import { ChevronRight, Trash2, Trophy, TrendingUp, Flame, Sparkles, Weight } from "lucide-react";
import { todayStr } from "@/lib/dates"
import {
  isCompanionEnabledForClient,
  getActiveCompanionView,
  getRandomLine,
  type ActiveCompanionView,
} from "@/lib/companions";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Client = {
  id: string;
  full_name: string;
  profile_id: string | null;
};

type WeightLog = {
  id: string;
  weight_kg: number;
  log_date: string;
  note: string | null;
};

type ProgressPhoto = {
  id: string;
  image_url: string;
  storage_path: string | null;
  signed_url?: string | null;
  log_date: string;
  note: string | null;
  photo_type: "front" | "back" | "side";
};

type PhotoWeek = {
  log_date: string;
  week_number: number;
  front: ProgressPhoto | null;
  back: ProgressPhoto | null;
  side: ProgressPhoto | null;
};

type MeasurementLog = {
  id: string;
  log_date: string;
  waist_cm: number | null;
  hips_cm: number | null;
  chest_cm: number | null;
  left_arm_cm: number | null;
  right_arm_cm: number | null;
  left_thigh_cm: number | null;
  right_thigh_cm: number | null;
  note: string | null;
};

type ExercisePR = {
  exercise_name: string;
  max_weight_kg: number;
  log_date: string;
  reps: number;
};

type StreakData = {
  current_streak: number;
  longest_streak: number;
  last_workout_date: string | null;
};

type TotalVolumeData = {
  total_weight_kg: number;
  total_sets: number;
  total_reps: number;
};

export default function ClientStatsPage() {
  const [client, setClient] = useState<Client | null>(null);

  const [latestWeight, setLatestWeight] = useState<WeightLog | null>(null);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [weightInput, setWeightInput] = useState("");
  const [savingWeight, setSavingWeight] = useState(false);

  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [sideFile, setSideFile] = useState<File | null>(null);
  const [photoNote, setPhotoNote] = useState("");
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [showAllWeeks, setShowAllWeeks] = useState(false);
  const [deletingWeek, setDeletingWeek] = useState<string | null>(null);

  const [latestMeasurements, setLatestMeasurements] = useState<MeasurementLog | null>(null);
  const [measurementLogs, setMeasurementLogs] = useState<MeasurementLog[]>([]);
  const [savingMeasurements, setSavingMeasurements] = useState(false);

  const [waistInput, setWaistInput] = useState("");
  const [hipsInput, setHipsInput] = useState("");
  const [chestInput, setChestInput] = useState("");
  const [leftArmInput, setLeftArmInput] = useState("");
  const [rightArmInput, setRightArmInput] = useState("");
  const [leftThighInput, setLeftThighInput] = useState("");
  const [rightThighInput, setRightThighInput] = useState("");
  const [measurementNote, setMeasurementNote] = useState("");

  // Personal Bests State
  const [exercisePRs, setExercisePRs] = useState<ExercisePR[]>([]);
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [totalVolume, setTotalVolume] = useState<TotalVolumeData | null>(null);
  const [loadingPRs, setLoadingPRs] = useState(false);

  const [loading, setLoading] = useState(true);

  const [companionEnabled, setCompanionEnabled] = useState(false);
const [companionView, setCompanionView] = useState<ActiveCompanionView | null>(null);
const [companionLine, setCompanionLine] = useState<string | null>(null);

const today = todayStr()

  const weightChartData = [...weightLogs]
    .sort((a, b) => a.log_date.localeCompare(b.log_date))
    .map((log) => ({
      date: log.log_date,
      weight: Number(log.weight_kg),
    }));

  const waistChartData = [...measurementLogs]
    .sort((a, b) => a.log_date.localeCompare(b.log_date))
    .filter((log) => log.waist_cm !== null)
    .map((log) => ({
      date: log.log_date,
      waist: Number(log.waist_cm),
    }));

  // Group photos into weeks
  const photoWeeks = useMemo(() => {
    const grouped = photos.reduce((acc, photo) => {
      if (!acc[photo.log_date]) {
        acc[photo.log_date] = {
          log_date: photo.log_date,
          week_number: 0,
          front: null,
          back: null,
          side: null,
        };
      }
      acc[photo.log_date][photo.photo_type] = photo;
      return acc;
    }, {} as Record<string, PhotoWeek>);

    const weeks = Object.values(grouped).sort((a, b) =>
      a.log_date.localeCompare(b.log_date)
    );

    // Assign week numbers
    weeks.forEach((week, index) => {
      week.week_number = index + 1;
    });

    return weeks;
  }, [photos]);

  const displayWeeks = useMemo(() => {
    if (photoWeeks.length === 0) return [];
    if (photoWeeks.length === 1) return photoWeeks;
    if (showAllWeeks) return photoWeeks;

    // Show first and last only
    return [photoWeeks[0], photoWeeks[photoWeeks.length - 1]];
  }, [photoWeeks, showAllWeeks]);

  const hasMiddleWeeks = photoWeeks.length > 2;

  const loadPersonalBests = async (clientId: string) => {
    setLoadingPRs(true);

    try {
      // Get all set logs with exercise names
      const { data: setLogs, error: setLogsError } = await supabase
        .from("client_program_set_logs")
        .select(`
          actual_weight_kg,
          actual_reps,
          created_at,
          client_program_day_exercise_id
        `)
        .eq("client_id", clientId)
        .eq("completed", true)
        .not("actual_weight_kg", "is", null)
        .order("actual_weight_kg", { ascending: false });

      if (setLogsError) throw setLogsError;

      if (setLogs && setLogs.length > 0) {
        // Get exercise names for these logs
        const exerciseIds = [...new Set(setLogs.map(log => log.client_program_day_exercise_id))];
        
        const { data: exercises, error: exercisesError } = await supabase
          .from("client_program_day_exercises")
          .select("id, exercise_name")
          .in("id", exerciseIds);

        if (exercisesError) throw exercisesError;

        // Create a map of exercise_id to exercise_name
        const exerciseMap = new Map(
          exercises?.map(ex => [ex.id, ex.exercise_name]) || []
        );

        // Group by exercise and find max weight for each
        const prMap = new Map<string, ExercisePR>();

        setLogs.forEach(log => {
          const exerciseName = exerciseMap.get(log.client_program_day_exercise_id);
          if (!exerciseName) return;

          const existing = prMap.get(exerciseName);
          
          if (!existing || log.actual_weight_kg > existing.max_weight_kg) {
            prMap.set(exerciseName, {
              exercise_name: exerciseName,
              max_weight_kg: log.actual_weight_kg,
              log_date: log.created_at.split("T")[0],
              reps: log.actual_reps || 0,
            });
          }
        });

        // Sort by weight and take top 5
        const topPRs = Array.from(prMap.values())
          .sort((a, b) => b.max_weight_kg - a.max_weight_kg)
          .slice(0, 5);

        setExercisePRs(topPRs);
      }

      // Get streak data
      const { data: streaks, error: streaksError } = await supabase
        .from("client_streaks")
        .select("*")
        .eq("client_id", clientId)
        .eq("streak_type", "workout")
        .single();

      if (streaksError && streaksError.code !== "PGRST116") {
        throw streaksError;
      }

      if (streaks) {
        setStreakData({
          current_streak: streaks.current_streak || 0,
          longest_streak: streaks.longest_streak || 0,
          last_workout_date: streaks.last_activity_date,
        });
      } else {
        setStreakData({
          current_streak: 0,
          longest_streak: 0,
          last_workout_date: null,
        });
      }

      // Calculate total volume lifted (all completed sets)
      const { data: allCompletedSets, error: volumeError } = await supabase
        .from("client_program_set_logs")
        .select("actual_weight_kg, actual_reps")
        .eq("client_id", clientId)
        .eq("completed", true)
        .not("actual_weight_kg", "is", null)
        .not("actual_reps", "is", null);

      if (volumeError) {
        console.error("Error loading volume data:", volumeError);
      } else if (allCompletedSets && allCompletedSets.length > 0) {
        const totalWeightLifted = allCompletedSets.reduce((sum, set) => {
          return sum + (set.actual_weight_kg * set.actual_reps);
        }, 0);

        setTotalVolume({
          total_weight_kg: Math.round(totalWeightLifted),
          total_sets: allCompletedSets.length,
          total_reps: allCompletedSets.reduce((sum, set) => sum + set.actual_reps, 0),
        });
      } else {
        setTotalVolume({
          total_weight_kg: 0,
          total_sets: 0,
          total_reps: 0,
        });
      }
    } catch (error) {
      console.error("Error loading personal bests:", error);
    } finally {
      setLoadingPRs(false);
    }
  };

  const loadStats = async () => {
    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setClient(null);
      setLoading(false);
      return;
    }

    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .select("id, full_name, profile_id")
      .eq("profile_id", user.id)
      .single();

    if (clientError || !clientData) {
      setClient(null);
      setLoading(false);
      return;
    }

    setClient(clientData);

    // Companion (only if enabled for this client)
const isEnabled = await isCompanionEnabledForClient(clientData.id);
setCompanionEnabled(isEnabled);

if (isEnabled) {
  const cv = await getActiveCompanionView(clientData.id);
  setCompanionView(cv);

  if (cv) {
    const line = await getRandomLine(cv.path.slug, "general");
    setCompanionLine(line);
  }
}
    // Load personal bests
    await loadPersonalBests(clientData.id);

    const { data: weightData } = await supabase
      .from("client_weight_logs")
      .select("*")
      .eq("client_id", clientData.id)
      .order("log_date", { ascending: false });

    if (weightData && weightData.length > 0) {
      setLatestWeight(weightData[0]);
      setWeightLogs(weightData);
    } else {
      setLatestWeight(null);
      setWeightLogs([]);
    }

    const { data: measurementData } = await supabase
      .from("client_measurement_logs")
      .select("*")
      .eq("client_id", clientData.id)
      .order("log_date", { ascending: false });

    if (measurementData && measurementData.length > 0) {
      setLatestMeasurements(measurementData[0]);
      setMeasurementLogs(measurementData);
    } else {
      setLatestMeasurements(null);
      setMeasurementLogs([]);
    }

    const { data: photoData } = await supabase
      .from("progress_photos")
      .select("*")
      .eq("client_id", clientData.id)
      .order("log_date", { ascending: true });

    if (photoData) {
      setPhotos(await withSignedProgressPhotoUrls(photoData));
    } else {
      setPhotos([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleSaveWeight = async () => {
    if (!client || weightInput.trim() === "") return;

    setSavingWeight(true);

    const { error } = await supabase
      .from("client_weight_logs")
      .insert([
        {
          client_id: client.id,
          weight_kg: Number(weightInput),
          log_date: today,
        },
      ]);

    if (error) {
      alert("Error saving weight");
      setSavingWeight(false);
      return;
    }

    setWeightInput("");
    setSavingWeight(false);
    await loadStats();
  };

  const handleSaveMeasurements = async () => {
    if (!client) return;

    setSavingMeasurements(true);

    const { error } = await supabase
      .from("client_measurement_logs")
      .insert([
        {
          client_id: client.id,
          log_date: today,
          waist_cm: waistInput === "" ? null : Number(waistInput),
          hips_cm: hipsInput === "" ? null : Number(hipsInput),
          chest_cm: chestInput === "" ? null : Number(chestInput),
          left_arm_cm: leftArmInput === "" ? null : Number(leftArmInput),
          right_arm_cm: rightArmInput === "" ? null : Number(rightArmInput),
          left_thigh_cm: leftThighInput === "" ? null : Number(leftThighInput),
          right_thigh_cm: rightThighInput === "" ? null : Number(rightThighInput),
          note: measurementNote.trim() || null,
        },
      ]);

    if (error) {
      alert("Error saving measurements");
      setSavingMeasurements(false);
      return;
    }

    setWaistInput("");
    setHipsInput("");
    setChestInput("");
    setLeftArmInput("");
    setRightArmInput("");
    setLeftThighInput("");
    setRightThighInput("");
    setMeasurementNote("");
    setSavingMeasurements(false);
    await loadStats();
  };

const handleUploadPhotos = async () => {
  if (!client || !frontFile || !backFile || !sideFile) {
    alert("Please select all 3 photos (Front, Back, Side)");
    return;
  }

  setUploadingPhotos(true);

  // Capture whether this is the user's first-ever photo upload BEFORE
  // we upload — once the upload succeeds, photos won't be empty anymore.
  const isFirstEverUpload = photos.length === 0;

  try {
    const uploads: Array<{ type: "front" | "back" | "side"; file: File }> = [
      { type: "front", file: frontFile },
      { type: "back", file: backFile },
      { type: "side", file: sideFile },
    ];

    for (const { type, file } of uploads) {
      const fileExt = file.name.split(".").pop();
      const filePath = `${client.id}/${today}-${type}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("progress-photos")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from("progress_photos")
        .insert([
          {
            client_id: client.id,
            image_url: filePath,
            storage_path: filePath,
            log_date: today,
            photo_type: type,
            note: photoNote || null,
          },
        ]);

      if (dbError) throw dbError;
    }

    // Award Bond XP for the first-ever photo upload — a "welcome to the journey"
    // moment. Self-disabling if companions aren't enabled. Subsequent uploads
    // (including weekly tracking and milestone-driven uploads) don't repeat this.
    if (isFirstEverUpload) {
      await awardBondXp(
        client.id,
        150,
        "first_progress_photos",
        "Uploaded your first set of progress photos"
      );
    }

    setFrontFile(null);
    setBackFile(null);
    setSideFile(null);
    setPhotoNote("");
    alert("Photos uploaded successfully!");
    await loadStats();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    alert(`Error uploading photos: ${message}`);
  } finally {
    setUploadingPhotos(false);
  }
};

  const handleDeleteWeek = async (log_date: string) => {
    if (!client) return;

    const confirmed = window.confirm(
      "Delete all 3 photos from this week? This cannot be undone."
    );
    if (!confirmed) return;

    setDeletingWeek(log_date);

    // Get all photos for this date
    const photosToDelete = photos.filter((p) => p.log_date === log_date);

    try {
      // Delete from storage
      for (const photo of photosToDelete) {
        const path = getProgressPhotoPath(photo);
        if (path) {
          await supabase.storage.from("progress-photos").remove([path]);
        }
      }

      // Delete from database
      const { error } = await supabase
        .from("progress_photos")
        .delete()
        .eq("client_id", client.id)
        .eq("log_date", log_date);

      if (error) throw error;

      await loadStats();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      alert(`Error deleting photos: ${message}`);
    } finally {
      setDeletingWeek(null);
    }
  };

  return (
    <>
      <h1 className={styles.display}>My Stats</h1>

      {loading ? (
        <p className={styles.body}>Loading stats...</p>
      ) : !client ? (
        <p className={styles.body}>Client not found.</p>
      ) : (
        <div className="mt-6 space-y-6">
          {/* Personal Bests Section */}
          <div className={styles.card}>
            <div className="flex items-center gap-2">
              <Trophy className="text-gold" size={24} />
              <h2 className={styles.h2}>Personal Bests</h2>
            </div>

            {loadingPRs ? (
              <p className={styles.body}>Loading personal bests...</p>
            ) : (
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {/* Total Weight Lifted */}
                <div className="rounded-xl border border-border-subtle bg-surface-raised p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Weight className="text-gold" size={20} />
                    <h3 className="text-sm font-semibold text-ink">Total Volume</h3>
                  </div>

                  {totalVolume ? (
                    <div className="space-y-3">
                      <div className="rounded-lg bg-surface-sunken p-3 text-center">
                        <p className="text-xs text-ink-muted mb-1">Total Weight Lifted</p>
                        <p className="text-3xl font-bold text-gold">
                          {totalVolume.total_weight_kg.toLocaleString()}
                        </p>
                        <p className="text-sm text-ink-muted">kg</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-surface-sunken p-2 text-center">
                          <p className="text-xs text-ink-muted">Sets</p>
                          <p className="text-lg font-semibold text-ink">
                            {totalVolume.total_sets.toLocaleString()}
                          </p>
                        </div>
                        <div className="rounded-lg bg-surface-sunken p-2 text-center">
                          <p className="text-xs text-ink-muted">Reps</p>
                          <p className="text-lg font-semibold text-ink">
                            {totalVolume.total_reps.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className={styles.body}>No workout data yet.</p>
                  )}
                </div>

{/* Companion / Motivation */}
<Link
  href="/client/companion"
  className="block rounded-xl border border-border-subtle bg-surface-raised p-4 transition hover:border-emerald"
>
  <div className="flex items-center gap-2 mb-3">
    <Sparkles className="text-emerald" size={20} />
    <h3 className="text-sm font-semibold text-ink">
      {companionEnabled ? "Your Companion" : "Keep Going"}
    </h3>
  </div>

  {companionEnabled && companionView ? (
    <div className="space-y-3">
      <div className="flex flex-col items-center gap-2">
        {companionView.currentForm.image_url ? (
          <img
            src={companionView.currentForm.image_url}
            alt={companionView.currentForm.name}
            className="h-75 w-75 rounded-lg border border-border-subtle object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-border-subtle bg-surface-sunken text-2xl">
            ?
          </div>
        )}
        <div className="text-center">
          <p className="text-sm font-semibold text-ink">
            {companionView.companion.custom_name ??
              companionView.path.default_name ??
              companionView.path.name}
          </p>
          <p className="text-xs text-emerald">
            {companionView.currentForm.name}
          </p>
        </div>
      </div>

      {companionLine && (
        <div className="rounded-lg bg-surface-sunken p-3 text-sm italic text-center text-ink">
          "{companionLine}"
        </div>
      )}
    </div>
  ) : (
    <div className="rounded-lg bg-surface-sunken p-4 text-center">
      <p className="text-sm italic text-ink">
        "Small actions compound. Like leaves, one at a time."
      </p>
    </div>
  )}
</Link>

                {/* Heaviest Lifts */}
                <div className="rounded-xl border border-border-subtle bg-surface-raised p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="text-gold" size={20} />
                    <h3 className="text-sm font-semibold text-ink">Heaviest Lifts</h3>
                  </div>

                  {exercisePRs.length === 0 ? (
                    <p className={styles.body}>No personal records yet. Keep lifting!</p>
                  ) : (
                    <div className="space-y-2">
                      {exercisePRs.map((pr, index) => (
                        <div
                          key={`${pr.exercise_name}-${index}`}
                          className="rounded-lg bg-surface-sunken p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-ink truncate">
                                {pr.exercise_name}
                              </p>
                              <p className="text-xs text-ink-muted">
                                {pr.log_date}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-gold">
                                {pr.max_weight_kg}kg
                              </p>
                              {pr.reps > 0 && (
                                <p className="text-xs text-ink-muted">
                                  {pr.reps} reps
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className={styles.card}>
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <h2 className={styles.h2}>Body Weight</h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Latest:{" "}
                  {latestWeight
                    ? `${latestWeight.weight_kg} kg`
                    : "No weight logged yet"}
                </p>
                {latestWeight && (
                  <p className="mt-1 text-xs text-ink-muted">
                    Logged on {latestWeight.log_date}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  className={styles.input}
                  placeholder="Weight (kg)"
                />
                <button
                  onClick={handleSaveWeight}
                  disabled={savingWeight}
                  className={styles.buttonPrimaryStats}
                >
                  {savingWeight ? "Saving..." : "Log Weight"}
                </button>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="mb-3 text-sm font-medium text-ink">
                Weight Progress
              </h3>

              {weightChartData.length < 2 ? (
                <p className={styles.body}>Log at least two weights to see a graph.</p>
              ) : (
                <div className="w-full min-w-0">
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={weightChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis domain={["dataMin - 1", "dataMax + 1"]} />
                      <Tooltip />
                      <Line type="monotone" dataKey="weight" strokeWidth={2} dot />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="mt-4 space-y-2">
              {weightLogs.length === 0 ? (
                <p className={styles.body}>No weight history yet.</p>
              ) : (
                weightLogs.slice(0, 10).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between rounded-lg border border-border-subtle px-3 py-2"
                  >
                    <span className="text-sm text-ink-muted">{log.log_date}</span>
                    <span className="font-medium text-ink">
                      {log.weight_kg} kg
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className={styles.card}>
            <h2 className={styles.h2}>Body Measurements</h2>

            <p className="mt-1 text-sm text-ink-muted">
              Latest waist:{" "}
              {latestMeasurements?.waist_cm !== null &&
              latestMeasurements?.waist_cm !== undefined
                ? `${latestMeasurements.waist_cm} cm`
                : "No measurements logged yet"}
            </p>
            {latestMeasurements && (
              <p className="mt-1 text-xs text-ink-muted">
                Logged on {latestMeasurements.log_date}
              </p>
            )}

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <input
                type="number"
                step="0.1"
                value={waistInput}
                onChange={(e) => setWaistInput(e.target.value)}
                className={styles.input}
                placeholder="Waist (cm)"
              />
              <input
                type="number"
                step="0.1"
                value={hipsInput}
                onChange={(e) => setHipsInput(e.target.value)}
                className={styles.input}
                placeholder="Hips (cm)"
              />
              <input
                type="number"
                step="0.1"
                value={chestInput}
                onChange={(e) => setChestInput(e.target.value)}
                className={styles.input}
                placeholder="Chest (cm)"
              />
              <input
                type="number"
                step="0.1"
                value={leftArmInput}
                onChange={(e) => setLeftArmInput(e.target.value)}
                className={styles.input}
                placeholder="Left arm (cm)"
              />
              <input
                type="number"
                step="0.1"
                value={rightArmInput}
                onChange={(e) => setRightArmInput(e.target.value)}
                className={styles.input}
                placeholder="Right arm (cm)"
              />
              <input
                type="number"
                step="0.1"
                value={leftThighInput}
                onChange={(e) => setLeftThighInput(e.target.value)}
                className={styles.input}
                placeholder="Left thigh (cm)"
              />
              <input
                type="number"
                step="0.1"
                value={rightThighInput}
                onChange={(e) => setRightThighInput(e.target.value)}
                className={styles.input}
                placeholder="Right thigh (cm)"
              />
              <input
                type="text"
                value={measurementNote}
                onChange={(e) => setMeasurementNote(e.target.value)}
                className={styles.input}
                placeholder="Optional note"
              />
            </div>

            <button
              onClick={handleSaveMeasurements}
              disabled={savingMeasurements}
              className={`${styles.buttonPrimaryStats} mt-4`}
            >
              {savingMeasurements ? "Saving..." : "Log Measurements"}
            </button>

            <div className="mt-6">
              <h3 className="mb-3 text-sm font-medium text-ink">
                Waist Progress
              </h3>

              {waistChartData.length < 2 ? (
                <p className={styles.body}>
                  Log at least two waist measurements to see a graph.
                </p>
              ) : (
                <div className="w-full min-w-0">
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={waistChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis domain={["dataMin - 1", "dataMax + 1"]} />
                      <Tooltip />
                      <Line type="monotone" dataKey="waist" strokeWidth={2} dot />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="mt-4 space-y-2">
              {measurementLogs.length === 0 ? (
                <p className={styles.body}>No measurement history yet.</p>
              ) : (
                measurementLogs.slice(0, 10).map((log) => (
                  <div
                    key={log.id}
                    className="rounded-lg border border-border-subtle px-3 py-2"
                  >
                    <p className="text-sm font-medium text-ink">
                      {log.log_date}
                    </p>
                    <p className="text-sm text-ink-muted">
                      Waist: {log.waist_cm ?? "-"} cm • Hips: {log.hips_cm ?? "-"} cm •
                      Chest: {log.chest_cm ?? "-"} cm
                    </p>
                    <p className="text-sm text-ink-muted">
                      Arms: {log.left_arm_cm ?? "-"} / {log.right_arm_cm ?? "-"} cm •
                      Thighs: {log.left_thigh_cm ?? "-"} / {log.right_thigh_cm ?? "-"} cm
                    </p>
                    {log.note && (
                      <p className="text-sm text-ink-muted">{log.note}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className={styles.card}>
            <h2 className={styles.h2}>Progress Photos</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Upload Front, Back, and Side photos together as a weekly set
            </p>

            <div className="mt-4 space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="text-sm font-medium text-ink">Front Photo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFrontFile(e.target.files?.[0] || null)}
                    className={`${styles.input} pt-2`}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-ink">Back Photo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setBackFile(e.target.files?.[0] || null)}
                    className={`${styles.input} pt-2`}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-ink">Side Photo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setSideFile(e.target.files?.[0] || null)}
                    className={`${styles.input} pt-2`}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={photoNote}
                  onChange={(e) => setPhotoNote(e.target.value)}
                  className={`${styles.input} flex-1`}
                  placeholder="Optional note (e.g., Week 1)"
                />
                <button
                  onClick={handleUploadPhotos}
                  disabled={uploadingPhotos || !frontFile || !backFile || !sideFile}
                  className={`${styles.buttonPrimaryStats} disabled:opacity-50`}
                >
                  {uploadingPhotos ? "Uploading..." : "Upload All 3"}
                </button>
              </div>
            </div>

{photoWeeks.length === 0 ? (
  <p className={`${styles.body} mt-6`}>
    No progress photos yet. Upload your first set!
  </p>
) : (
  <div className="mt-6">
    {/* Photo comparison rows */}
    <div className="space-y-6">
      {/* Front Row */}
      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Front</p>
        <div className="flex items-center gap-4">
          {displayWeeks.map((week, index) => (
            <div key={`front-${week.log_date}`} className="flex items-center gap-4">
              {/* Week Card */}
              <div className="flex-1">
                <p className="mb-2 text-xs font-medium text-ink-muted">
                  Week {week.week_number} - {week.log_date}
                </p>
                {week.front ? (
                  <img
                    src={week.front.signed_url ?? week.front.image_url}
                    alt="Front"
                    className="h-48 w-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center rounded-lg bg-surface-sunken text-xs text-ink-muted">
                    No photo
                  </div>
                )}
              </div>

              {/* Arrow between first and last */}
              {index === 0 && !showAllWeeks && hasMiddleWeeks && (
                <button
                  onClick={() => setShowAllWeeks(true)}
                  className="flex flex-col items-center gap-1 px-4 text-gold hover:opacity-80"
                  title="Show all weeks"
                >
                  <ChevronRight size={32} />
                  <span className="text-xs font-medium">
                    {photoWeeks.length - 2} week{photoWeeks.length - 2 !== 1 ? "s" : ""}
                  </span>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Back Row */}
      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Back</p>
        <div className="flex items-center gap-4">
          {displayWeeks.map((week, index) => (
            <div key={`back-${week.log_date}`} className="flex items-center gap-4">
              {/* Week Card */}
              <div className="flex-1">
                <p className="mb-2 text-xs font-medium text-ink-muted">
                  Week {week.week_number} - {week.log_date}
                </p>
                {week.back ? (
                  <img
                    src={week.back.signed_url ?? week.back.image_url}
                    alt="Back"
                    className="h-48 w-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center rounded-lg bg-surface-sunken text-xs text-ink-muted">
                    No photo
                  </div>
                )}
              </div>

              {/* Arrow (invisible spacer to maintain alignment) */}
              {index === 0 && !showAllWeeks && hasMiddleWeeks && (
                <div className="w-20" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Side Row */}
      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Side</p>
        <div className="flex items-center gap-4">
          {displayWeeks.map((week, index) => (
            <div key={`side-${week.log_date}`} className="flex items-center gap-4">
              {/* Week Card */}
              <div className="flex-1">
                <p className="mb-2 text-xs font-medium text-ink-muted">
                  Week {week.week_number} - {week.log_date}
                </p>
                {week.side ? (
                  <img
                    src={week.side.signed_url ?? week.side.image_url}
                    alt="Side"
                    className="h-48 w-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center rounded-lg bg-surface-sunken text-xs text-ink-muted">
                    No photo
                  </div>
                )}
              </div>

              {/* Arrow (invisible spacer to maintain alignment) */}
              {index === 0 && !showAllWeeks && hasMiddleWeeks && (
                <div className="w-20" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Delete buttons row */}
      <div className="flex items-center gap-4">
        {displayWeeks.map((week, index) => (
          <div key={`delete-${week.log_date}`} className="flex items-center gap-4">
            <div className="flex-1">
              <button
                onClick={() => handleDeleteWeek(week.log_date)}
                disabled={deletingWeek === week.log_date}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                title="Delete this week"
              >
                <Trash2 size={16} />
                Delete Week {week.week_number}
              </button>
            </div>

            {/* Arrow spacer */}
            {index === 0 && !showAllWeeks && hasMiddleWeeks && (
              <div className="w-20" />
            )}
          </div>
        ))}
      </div>
    </div>

    {showAllWeeks && hasMiddleWeeks && (
      <button
        onClick={() => setShowAllWeeks(false)}
        className="mt-4 text-sm text-gold hover:underline"
      >
        Show only first and latest
      </button>
    )}
  </div>
)}
          </div>
        </div>
      )}
    </>
  );
}
