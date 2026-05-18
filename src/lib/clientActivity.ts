import { supabase } from "@/lib/supabase";

const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

let lastTouchAt = 0;
let touchInFlight = false;

export async function touchClientLastSeen() {
  const now = Date.now();

  if (touchInFlight || now - lastTouchAt < TOUCH_INTERVAL_MS) {
    return;
  }

  touchInFlight = true;
  lastTouchAt = now;

  try {
    const { error } = await supabase.rpc("touch_client_last_seen");

    if (error && error.code !== "PGRST202") {
      console.warn("Could not update client activity timestamp:", error.message);
    }
  } finally {
    touchInFlight = false;
  }
}
