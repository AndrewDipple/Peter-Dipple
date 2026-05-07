import { supabase } from "./supabase";

type StreakType = "workout" | "water" | "nutrition";

export async function updateStreak(
  clientId: string,
  streakType: StreakType,
  activityDate: string
): Promise<string[]> {
  // Get current streak
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
      // Same day, no change
      return [];  // ✅ No new achievements
    } else if (diffDays === 1) {
      // Consecutive day, increment streak
      currentStreak = (existingStreak?.current_streak || 0) + 1;
      longestStreak = Math.max(
        currentStreak,
        existingStreak?.longest_streak || 0
      );
    } else {
      // Streak broken, reset to 1
      currentStreak = 1;
      longestStreak = existingStreak?.longest_streak || 1;
    }
  }

  // Upsert streak
  const { data, error } = await supabase
    .from("client_streaks")
    .upsert(
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
    )
    .select()
    .single();

  if (error) {
    console.error("Error updating streak:", error);
    return [];  // ✅ Return empty array on error
  }

  // Check for achievement milestones
  const unlockedAchievements = await checkStreakAchievements(clientId, streakType, currentStreak);

  return unlockedAchievements;  // ✅ Return the unlocked achievements
}

async function checkStreakAchievements(
  clientId: string,
  streakType: StreakType,
  currentStreak: number
): Promise<string[]> {  // ✅ Now returns array of achievement types
  const achievements: string[] = [];
  const newlyUnlocked: string[] = [];

  if (streakType === "workout") {
    if (currentStreak === 7) achievements.push("workout_streak_7");
    if (currentStreak === 30) achievements.push("workout_streak_30");
    if (currentStreak === 100) achievements.push("workout_streak_100");
  }

  if (streakType === "water") {
    if (currentStreak === 7) achievements.push("water_streak_7");
    if (currentStreak === 30) achievements.push("water_streak_30");
  }

  for (const achievement of achievements) {
    // Check if already earned
    const { data: existing } = await supabase
      .from("client_achievements")
      .select("id")
      .eq("client_id", clientId)
      .eq("achievement_type", achievement)
      .single();

    if (!existing) {
      // Award achievement
      await supabase.from("client_achievements").insert({
        client_id: clientId,
        achievement_type: achievement,
      });

      newlyUnlocked.push(achievement);
    }
  }

  return newlyUnlocked;
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

export async function checkStreakReminders(clientId: string) {
  const today = new Date().toISOString().split("T")[0];
  
  const streaks = await getClientStreaks(clientId);
  
  for (const streak of streaks) {
    // Check if last activity was yesterday (streak is in danger)
    const lastActivity = streak.last_activity_date;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    
    if (lastActivity === yesterdayStr && streak.current_streak > 0) {
      // Streak is in danger! Send reminder
      const streakName = streak.streak_type === "workout" 
        ? "workout" 
        : streak.streak_type === "water" 
        ? "water" 
        : "nutrition";
      
      // Get client's profile_id
      const { data: client } = await supabase
        .from("clients")
        .select("profile_id")
        .eq("id", clientId)
        .single();
      
      if (!client?.profile_id) continue;
      
      // Check if we already sent a reminder today
      const { data: existingReminder } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", client.profile_id)
        .eq("type", "streak_reminder")
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`)
        .maybeSingle();
      
      if (existingReminder) continue; // Already sent today
      
      // Send reminder
      await supabase.from("notifications").insert({
        user_id: client.profile_id,
        type: "streak_reminder",
        title: `Don't break your ${streak.current_streak}-day ${streakName} streak!`,
        message: `You're on a ${streak.current_streak}-day ${streakName} streak. Keep it going today!`,
        link: streak.streak_type === "workout" 
          ? "/client/workout" 
          : streak.streak_type === "water"
          ? "/client/dashboard"
          : "/client/nutrition",
      });
    }
  }
}
