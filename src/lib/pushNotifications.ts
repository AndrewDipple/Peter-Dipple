import { supabase } from "@/lib/supabase";

export type PushStatus =
  | "unsupported"
  | "missing_key"
  | "blocked"
  | "available"
  | "enabled"
  | "not_configured";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

async function getReadyServiceWorkerRegistration() {
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!isPushSupported()) return "unsupported";
  if (!vapidPublicKey) return "missing_key";
  if (Notification.permission === "denied") return "blocked";

  const registration =
    (await navigator.serviceWorker.getRegistration("/sw.js")) ??
    (await navigator.serviceWorker.getRegistration());
  const subscription = await registration?.pushManager.getSubscription();

  return subscription ? "enabled" : "available";
}

export async function enablePushNotifications() {
  if (!isPushSupported()) {
    return {
      ok: false,
      status: "unsupported" as PushStatus,
      message: "Push notifications are not supported on this browser.",
    };
  }

  if (!vapidPublicKey) {
    return {
      ok: false,
      status: "missing_key" as PushStatus,
      message: "Push notifications need a VAPID public key before they can be enabled.",
    };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return {
      ok: false,
      status: permission === "denied" ? "blocked" as PushStatus : "available" as PushStatus,
      message:
        permission === "denied"
          ? "Push notifications are blocked in this browser."
          : "Push notification permission was not granted.",
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      status: "available" as PushStatus,
      message: "Please sign in again before enabling push notifications.",
    };
  }

  let subscription: PushSubscription;

  try {
    const registration = await getReadyServiceWorkerRegistration();
    subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      }));
  } catch (error) {
    return {
      ok: false,
      status: "available" as PushStatus,
      message:
        error instanceof Error
          ? error.message
          : "Could not create a push subscription on this device.",
    };
  }

  const serialized = subscription.toJSON();
  const p256dh = serialized.keys?.p256dh;
  const auth = serialized.keys?.auth;

  if (!serialized.endpoint || !p256dh || !auth) {
    return {
      ok: false,
      status: "available" as PushStatus,
      message: "The browser did not return a complete push subscription.",
    };
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: serialized.endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent,
      enabled: true,
      updated_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    return {
      ok: false,
      status: "not_configured" as PushStatus,
      message:
        error.code === "42P01"
          ? "Run the push subscriptions SQL before enabling push notifications."
          : error.message,
    };
  }

  return {
    ok: true,
    status: "enabled" as PushStatus,
    message: "Push notifications enabled on this device.",
  };
}

export async function disablePushNotifications() {
  if (!isPushSupported()) {
    return {
      ok: false,
      status: "unsupported" as PushStatus,
      message: "Push notifications are not supported on this browser.",
    };
  }

  const registration =
    (await navigator.serviceWorker.getRegistration("/sw.js")) ??
    (await navigator.serviceWorker.getRegistration());
  const subscription = await registration?.pushManager.getSubscription();

  if (!subscription) {
    return {
      ok: true,
      status: "available" as PushStatus,
      message: "Push notifications are already off on this device.",
    };
  }

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  await supabase
    .from("push_subscriptions")
    .update({ enabled: false, updated_at: new Date().toISOString() })
    .eq("endpoint", endpoint);

  return {
    ok: true,
    status: "available" as PushStatus,
    message: "Push notifications disabled on this device.",
  };
}
