import { supabase } from "./supabase";

type StreakType = "workout" | "water" | "nutrition";

export async function updateStreak(
  clientId: string,
  streakType: StreakType,
  activityDate: string
): Promise<string[]> {
  const { data: existingStreak } = await supabase
    .from("client_streaks")
    .select("*")
    .eq("client_id", clientId)
    .eq("streak_type", streakType)
    .single();

  const today = new Date(activityDate);
  const lastActivity = existingStreak?.last_activity_date
    ? new Date(existingStreak.last_activity_date)
    : null;

  let currentStreak = 1;
  let longestStreak = 1;

  if (lastActivity) {
    const diffDays = Math.floor(
      (today.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) {
      return [];
    }

    if (diffDays === 1) {
      currentStreak = (existingStreak?.current_streak || 0) + 1;
      longestStreak = Math.max(
        currentStreak,
        existingStreak?.longest_streak || 0
      );
    } else {
      currentStreak = 1;
      longestStreak = existingStreak?.longest_streak || 1;
    }
  }

  const { error } = await supabase.from("client_streaks").upsert(
    {
      client_id: clientId,
      streak_type: streakType,
      current_streak: currentStreak,
      longest_streak: longestStreak,
      last_activity_date: activityDate,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "client_id,streak_type",
    }
  );

  if (error) {
    console.error("Error updating streak:", error);
  }

  return [];
}

export async function getClientStreaks(clientId: string) {
  const { data } = await supabase
    .from("client_streaks")
    .select("*")
    .eq("client_id", clientId);

  return data || [];
}

export async function getClientAchievements(clientId: string) {
  const { data } = await supabase
    .from("client_achievements")
    .select("*")
    .eq("client_id", clientId)
    .order("earned_at", { ascending: false });

  return data || [];
}
