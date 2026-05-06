import type { SupabaseClient } from "@supabase/supabase-js";

type AdminAuditEvent = {
  eventType: string;
  actorProfileId: string;
  targetClientId?: string | null;
  targetProfileId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function recordAdminAuditEvent(
  supabaseAdmin: SupabaseClient,
  event: AdminAuditEvent
) {
  const { error } = await supabaseAdmin.from("admin_audit_events").insert({
    event_type: event.eventType,
    actor_profile_id: event.actorProfileId,
    target_client_id: event.targetClientId ?? null,
    target_profile_id: event.targetProfileId ?? null,
    metadata: event.metadata ?? {},
  });

  if (error) {
    console.warn("Admin audit event was not recorded", {
      eventType: event.eventType,
      message: error.message,
    });
  }
}
