"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";
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
  log_date: string;
  note: string | null;
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

export default function ClientStatsPage() {
  const [client, setClient] = useState<Client | null>(null);

  const [latestWeight, setLatestWeight] = useState<WeightLog | null>(null);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [weightInput, setWeightInput] = useState("");
  const [savingWeight, setSavingWeight] = useState(false);

  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoNote, setPhotoNote] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

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

  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split("T")[0];

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
      .order("log_date", { ascending: false })
      .limit(24);

    if (photoData) {
      setPhotos(photoData);
    } else {
      setPhotos([]);
    }

    setLoading(false);
  };

const [chartsReady, setChartsReady] = useState(false);
useEffect(() => {
  setChartsReady(true);
}, []);

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

  const handleUploadPhoto = async () => {
    if (!client || !photoFile) return;

    setUploadingPhoto(true);

    const fileExt = photoFile.name.split(".").pop();
    const filePath = `${client.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("progress-photos")
      .upload(filePath, photoFile);

    if (uploadError) {
      alert(`Error uploading photo: ${uploadError.message}`);
      setUploadingPhoto(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("progress-photos")
      .getPublicUrl(filePath);

    const imageUrl = publicUrlData.publicUrl;

    const { error } = await supabase
      .from("progress_photos")
      .insert([
        {
          client_id: client.id,
          image_url: imageUrl,
          log_date: today,
          note: photoNote || null,
        },
      ]);

    if (error) {
      alert("Error saving photo record");
      setUploadingPhoto(false);
      return;
    }

    setPhotoFile(null);
    setPhotoNote("");
    setUploadingPhoto(false);
    await loadStats();
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

            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <div>
                <label className="text-sm font-medium text-ink">
                  Upload photo
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                  className={`${styles.input} pt-2`}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-ink">Note</label>
                <input
                  type="text"
                  value={photoNote}
                  onChange={(e) => setPhotoNote(e.target.value)}
                  className={styles.input}
                  placeholder="Optional note"
                />
              </div>

              <button
                onClick={handleUploadPhoto}
                disabled={uploadingPhoto || !photoFile}
                className={styles.buttonPrimaryStats}
              >
                {uploadingPhoto ? "Uploading..." : "Upload"}
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {photos.length === 0 ? (
                <p className={styles.body}>No progress photos yet.</p>
              ) : (
                photos.map((photo) => (
                  <div key={photo.id} className={`${styles.card} p-3`}>
                    <img
                      src={photo.image_url}
                      alt="Progress"
                      className="h-56 w-full rounded-xl object-cover"
                    />
                    <p className="mt-2 text-sm font-medium text-ink">
                      {photo.log_date}
                    </p>
                    {photo.note && (
                      <p className="mt-1 text-sm text-ink-muted">
                        {photo.note}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}