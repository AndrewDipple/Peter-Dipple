import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { recordAdminAuditEvent } from "@/lib/adminAudit";

const isAdminRole = (role: string | null | undefined) => role === "admin";

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        persistSession: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
      },
    });

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !isAdminRole(profile?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { clientId, action } = await request.json();

    if (typeof clientId !== "string" || !clientId) {
      return NextResponse.json({ error: "Missing client id" }, { status: 400 });
    }

    if (
      action !== "start_retention" &&
      action !== "record_deletion_request" &&
      action !== "clear_retention"
    ) {
      return NextResponse.json({ error: "Invalid retention action" }, { status: 400 });
    }

    const now = new Date();
    const update =
      action === "start_retention"
        ? {
            archived_at: now.toISOString(),
            deletion_requested_at: null,
            delete_after: addMonths(now, 12).toISOString(),
          }
        : action === "record_deletion_request"
          ? {
              deletion_requested_at: now.toISOString(),
              delete_after: now.toISOString(),
            }
          : {
              archived_at: null,
              deletion_requested_at: null,
              delete_after: null,
            };

    const { data: client, error: updateError } = await supabaseAdmin
      .from("clients")
      .update(update)
      .eq("id", clientId)
      .select("id, profile_id, archived_at, deletion_requested_at, delete_after")
      .maybeSingle();

    if (updateError || !client) {
      return NextResponse.json(
        { error: updateError?.message ?? "Could not update retention state" },
        { status: 500 }
      );
    }

    const eventType =
      action === "start_retention"
        ? "retention_started"
        : action === "record_deletion_request"
          ? "deletion_requested"
          : "retention_cleared";

    await recordAdminAuditEvent(supabaseAdmin, {
      eventType,
      actorProfileId: user.id,
      targetClientId: client.id,
      targetProfileId: client.profile_id,
      metadata: {
        archivedAt: client.archived_at,
        deletionRequestedAt: client.deletion_requested_at,
        deleteAfter: client.delete_after,
      },
    });

    return NextResponse.json({ client });
  } catch (error) {
    console.error("Unhandled error in client-retention", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
