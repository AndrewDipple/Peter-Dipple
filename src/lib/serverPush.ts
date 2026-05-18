import "server-only";

import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

let configured = false;

function configureWebPush() {
  if (configured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export async function sendPushToUsers(
  supabaseAdmin: SupabaseClient,
  userIds: string[],
  payload: PushPayload
) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueUserIds.length === 0) {
    return { sent: 0, failed: 0, skipped: true };
  }

  if (!configureWebPush()) {
    return { sent: 0, failed: 0, skipped: true };
  }

  const { data: subscriptions, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", uniqueUserIds)
    .eq("enabled", true);

  if (error || !subscriptions?.length) {
    return { sent: 0, failed: error ? 1 : 0, skipped: !error };
  }

  let sent = 0;
  let failed = 0;

  await Promise.all(
    (subscriptions as PushSubscriptionRow[]).map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          JSON.stringify(payload)
        );
        sent += 1;
      } catch (sendError: unknown) {
        failed += 1;
        const statusCode =
          typeof sendError === "object" &&
          sendError !== null &&
          "statusCode" in sendError
            ? Number((sendError as { statusCode?: number }).statusCode)
            : null;

        if (statusCode === 404 || statusCode === 410) {
          await supabaseAdmin
            .from("push_subscriptions")
            .update({
              enabled: false,
              updated_at: new Date().toISOString(),
            })
            .eq("id", subscription.id);
        }
      }
    })
  );

  return { sent, failed, skipped: false };
}
