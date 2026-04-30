import { supabase } from "@/lib/supabase";

export async function createNotification({
  userId,
  type,
  title,
  message,
  link,
}: {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
}) {
  const { error } = await supabase.from("notifications").insert([
    {
      user_id: userId,
      type,
      title,
      message,
      link: link || null,
    },
  ]);

  if (error) {
    console.error("Error creating notification:", error);
  }
}

// Specific notification creators
export async function notifyProgramAssigned(
  clientId: string,
  clientName: string,
  programName: string
) {
  // Get client's profile_id
  const { data: client } = await supabase
    .from("clients")
    .select("profile_id")
    .eq("id", clientId)
    .single();

  if (!client?.profile_id) return;

  await createNotification({
    userId: client.profile_id,
    type: "program_assigned",
    title: "New Program Assigned",
    message: `Your trainer has assigned you the "${programName}" program`,
    link: "/client/workout",
  });
}

export async function notifyMilestoneDue(clientId: string, weekNumber: number) {
  const { data: client } = await supabase
    .from("clients")
    .select("profile_id")
    .eq("id", clientId)
    .single();

  if (!client?.profile_id) return;

  await createNotification({
    userId: client.profile_id,
    type: "milestone_due",
    title: `Week ${weekNumber} Milestone Due`,
    message: `Complete your Week ${weekNumber} questionnaire and progress photos`,
    link: "/client/dashboard",
  });
}

export async function notifyMilestoneCompleted(
  trainerProfileId: string,
  clientName: string,
  weekNumber: number
) {
  await createNotification({
    userId: trainerProfileId,
    type: "milestone_completed",
    title: "Milestone Completed",
    message: `${clientName} completed their Week ${weekNumber} milestone`,
    link: "/trainer/clients",
  });
}

export async function notifyClientInactive(
  trainerProfileId: string,
  clientName: string,
  daysSinceLogin: number
) {
  await createNotification({
    userId: trainerProfileId,
    type: "client_inactive",
    title: "Client Inactive",
    message: `${clientName} hasn't logged in for ${daysSinceLogin} days`,
    link: "/trainer/clients",
  });
}
