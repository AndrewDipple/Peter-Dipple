import { supabase } from "@/lib/supabase";

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
