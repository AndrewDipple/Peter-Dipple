"use client";

import { useEffect, useState } from "react";
import { getClientStreaks, getClientAchievements } from "@/lib/streaks";
import { Flame, Trophy, Award } from "lucide-react";

type Streak = {
  id: string;
  streak_type: string;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string;
};

type Achievement = {
  id: string;
  achievement_type: string;
  earned_at: string;
};

type StreakDisplayProps = {
  clientId: string;
};

const achievementDetails: Record<string, { icon: string; title: string; description: string }> = {
  workout_streak_7: {
    icon: "🔥",
    title: "Week Warrior",
    description: "7-day workout streak",
  },
  workout_streak_30: {
    icon: "💪",
    title: "Month Master",
    description: "30-day workout streak",
  },
  workout_streak_100: {
    icon: "👑",
    title: "Century Champion",
    description: "100-day workout streak",
  },
  water_streak_7: {
    icon: "💧",
    title: "Hydration Hero",
    description: "7-day water streak",
  },
  water_streak_30: {
    icon: "🌊",
    title: "Water Warrior",
    description: "30-day water streak",
  },
  nutrition_consistent_week: {
    icon: "🥗",
    title: "Nutrition Ninja",
    description: "Consistent nutrition for a week",
  },
  first_workout: {
    icon: "🎯",
    title: "First Step",
    description: "Completed first workout",
  },
  first_progress_photo: {
    icon: "📸",
    title: "Progress Tracker",
    description: "Uploaded first progress photo",
  },
  weight_loss_5kg: {
    icon: "⚖️",
    title: "5kg Down",
    description: "Lost 5kg",
  },
  weight_loss_10kg: {
    icon: "🏆",
    title: "10kg Champion",
    description: "Lost 10kg",
  },
};

export default function StreakDisplay({ clientId }: StreakDisplayProps) {
  const [streaks, setStreaks] = useState<Streak[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStreaks = async () => {
      const [streaksData, achievementsData] = await Promise.all([
        getClientStreaks(clientId),
        getClientAchievements(clientId),
      ]);

      setStreaks(streaksData);
      setAchievements(achievementsData);
      setLoading(false);
    };

    loadStreaks();
  }, [clientId]);

  const getStreakColor = (type: string) => {
    if (type === "workout") return "from-red-500 to-orange-500";
    if (type === "water") return "from-blue-500 to-cyan-500";
    if (type === "nutrition") return "from-green-500 to-emerald-500";
    return "from-gold to-amber-500";
  };

  const getStreakIcon = (type: string) => {
    if (type === "workout") return "💪";
    if (type === "water") return "💧";
    if (type === "nutrition") return "🥗";
    return "🔥";
  };

  const getStreakName = (type: string) => {
    if (type === "workout") return "Workout";
    if (type === "water") return "Water";
    if (type === "nutrition") return "Nutrition";
    return type;
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border-subtle bg-surface-raised p-6">
        <p className="text-sm text-ink-muted">Loading streaks...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Streaks Section */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <Flame className="text-orange-500" size={24} />
          <h2 className="text-xl font-bold text-ink">Your Streaks</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {streaks.length === 0 ? (
            <div className="col-span-3 rounded-xl border border-border-subtle bg-surface-raised p-6 text-center">
              <p className="text-sm text-ink-muted">
                Start working out, drinking water, or logging meals to build your streaks!
              </p>
            </div>
          ) : (
            streaks.map((streak) => (
              <div
                key={streak.id}
                className="relative overflow-hidden rounded-xl border border-border-subtle bg-surface-raised p-6"
              >
                {/* Background gradient */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${getStreakColor(
                    streak.streak_type
                  )} opacity-10`}
                />

                {/* Content */}
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl">{getStreakIcon(streak.streak_type)}</span>
                    <Flame className="text-orange-500" size={20} />
                  </div>

                  <p className="mt-3 text-sm font-medium text-ink-muted">
                    {getStreakName(streak.streak_type)} Streak
                  </p>

                  <div className="mt-2 flex items-baseline gap-2">
                    <p className="text-4xl font-bold text-ink">
                      {streak.current_streak}
                    </p>
                    <p className="text-sm text-ink-muted">
                      day{streak.current_streak !== 1 ? "s" : ""}
                    </p>
                  </div>

                  <p className="mt-2 text-xs text-ink-muted">
                    Best: {streak.longest_streak} day{streak.longest_streak !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Achievements Section */}
      {achievements.length > 0 && (
        <div>
          <div className="mb-4 flex items-center gap-2">
            <Trophy className="text-gold" size={24} />
            <h2 className="text-xl font-bold text-ink">Achievements</h2>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {achievements.map((achievement) => {
              const details = achievementDetails[achievement.achievement_type] || {
                icon: "🏆",
                title: achievement.achievement_type,
                description: "Achievement unlocked!",
              };

              return (
                <div
                  key={achievement.id}
                  className="flex items-start gap-3 rounded-xl border border-gold/20 bg-gold/5 p-4"
                >
                  <span className="text-3xl">{details.icon}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-ink">{details.title}</p>
                    <p className="text-xs text-ink-muted">{details.description}</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      Earned {new Date(achievement.earned_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Motivational Message */}
      {streaks.length > 0 && (
        <div className="rounded-xl border border-gold/20 bg-gold/5 p-6 text-center">
          <Award className="mx-auto mb-3 text-gold" size={32} />
          <p className="font-semibold text-ink">
            Keep going! You're on fire! 🔥
          </p>
          <p className="mt-2 text-sm text-ink-muted">
            Consistency is the key to success. Every day counts!
          </p>
        </div>
      )}
    </div>
  );
}