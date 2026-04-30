"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Trophy, Medal, Award } from "lucide-react";

type LeaderboardEntry = {
  client_id: string;
  client_name: string;
  streak_type: string;
  current_streak: number;
  longest_streak: number;
};

type LeaderboardProps = {
  currentClientId?: string;
};

export default function Leaderboard({ currentClientId }: LeaderboardProps) {
  const [workoutLeaders, setWorkoutLeaders] = useState<LeaderboardEntry[]>([]);
  const [waterLeaders, setWaterLeaders] = useState<LeaderboardEntry[]>([]);
  const [nutritionLeaders, setNutritionLeaders] = useState<LeaderboardEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"workout" | "water" | "nutrition">("workout");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    // Get all streaks with client names
    const { data: streaksData } = await supabase
      .from("client_streaks")
      .select(`
        client_id,
        streak_type,
        current_streak,
        longest_streak,
        clients!inner(full_name)
      `)
      .order("current_streak", { ascending: false });

    if (!streaksData) {
      setLoading(false);
      return;
    }

    // Process and separate by type
    const processedData = streaksData.map((item: any) => ({
      client_id: item.client_id,
      client_name: item.clients.full_name,
      streak_type: item.streak_type,
      current_streak: item.current_streak,
      longest_streak: item.longest_streak,
    }));

    setWorkoutLeaders(
      processedData
        .filter((entry) => entry.streak_type === "workout")
        .slice(0, 10)
    );

    setWaterLeaders(
      processedData
        .filter((entry) => entry.streak_type === "water")
        .slice(0, 10)
    );

    setNutritionLeaders(
      processedData
        .filter((entry) => entry.streak_type === "nutrition")
        .slice(0, 10)
    );

    setLoading(false);
  };

  const getMedalIcon = (position: number) => {
    if (position === 1) return <Trophy className="text-yellow-500" size={24} />;
    if (position === 2) return <Medal className="text-gray-400" size={24} />;
    if (position === 3) return <Medal className="text-amber-600" size={24} />;
    return <Award className="text-ink-muted" size={20} />;
  };

  const currentLeaders =
    activeTab === "workout"
      ? workoutLeaders
      : activeTab === "water"
      ? waterLeaders
      : nutritionLeaders;

  const getTabStyle = (tab: "workout" | "water" | "nutrition") => {
    return activeTab === tab
      ? "rounded-lg bg-gold px-4 py-2 text-sm font-medium text-ink"
      : "rounded-lg px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-sunken";
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border-subtle bg-surface-raised p-6">
        <p className="text-sm text-ink-muted">Loading leaderboard...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-raised p-6">
      <div className="mb-6 flex items-center gap-2">
        <Trophy className="text-gold" size={24} />
        <h2 className="text-xl font-bold text-ink">Leaderboard</h2>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto rounded-xl bg-surface-sunken p-2">
        <button
          onClick={() => setActiveTab("workout")}
          className={getTabStyle("workout")}
        >
          💪 Workout
        </button>
        <button
          onClick={() => setActiveTab("water")}
          className={getTabStyle("water")}
        >
          💧 Water
        </button>
        <button
          onClick={() => setActiveTab("nutrition")}
          className={getTabStyle("nutrition")}
        >
          🥗 Nutrition
        </button>
      </div>

      {/* Leaderboard List */}
      {currentLeaders.length === 0 ? (
        <p className="text-center text-sm text-ink-muted">
          No streaks recorded yet. Be the first!
        </p>
      ) : (
        <div className="space-y-2">
          {currentLeaders.map((entry, index) => {
            const isCurrentUser = entry.client_id === currentClientId;
            
            return (
              <div
                key={`${entry.client_id}-${entry.streak_type}`}
                className={`flex items-center gap-4 rounded-lg p-4 transition ${
                  isCurrentUser
                    ? "border-2 border-gold bg-gold/10"
                    : "border border-border-subtle bg-surface-sunken"
                }`}
              >
                {/* Position */}
                <div className="flex w-12 items-center justify-center">
                  {index < 3 ? (
                    getMedalIcon(index + 1)
                  ) : (
                    <span className="text-lg font-bold text-ink-muted">
                      #{index + 1}
                    </span>
                  )}
                </div>

                {/* Name */}
                <div className="flex-1">
                  <p className={`font-semibold ${isCurrentUser ? "text-gold" : "text-ink"}`}>
                    {entry.client_name}
                    {isCurrentUser && " (You)"}
                  </p>
                  <p className="text-xs text-ink-muted">
                    Best: {entry.longest_streak} days
                  </p>
                </div>

                {/* Streak */}
                <div className="text-right">
                  <p className="text-2xl font-bold text-ink">
                    {entry.current_streak}
                  </p>
                  <p className="text-xs text-ink-muted">
                    day{entry.current_streak !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}