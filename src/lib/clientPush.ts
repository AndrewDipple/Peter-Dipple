import { supabase } from "@/lib/supabase";

type PushResult = {
  sent: number;
  failed: number;
  skipped: boolean;
};

type PushApiResponse = {
  success: boolean;
  push: PushResult;
};

export async function notifyClientMessagePush(messageId: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) return;

  try {
    await fetch("/api/push/client-message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ messageId }),
    });
  } catch (error) {
    console.warn("Push notification request failed:", error);
  }
}

export async function sendTestPush(): Promise<PushApiResponse | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) return null;

  const response = await fetch("/api/push/test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Test push request failed");
  }

  return response.json();
}

export async function notifyAdminFeedbackPush(feedbackId: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) return;

  try {
    await fetch("/api/push/feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ feedbackId }),
    });
  } catch (error) {
    console.warn("Feedback push notification request failed:", error);
  }
}

export async function notifyCommunityPush(
  type: "reply" | "reaction",
  id: string
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) return;

  try {
    await fetch("/api/push/community", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ type, id }),
    });
  } catch (error) {
    console.warn("Community push notification request failed:", error);
  }
}
