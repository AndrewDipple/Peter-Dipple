import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { recordAdminAuditEvent } from "@/lib/adminAudit";

const isAdminRole = (role: string | null | undefined) => role === "admin";

type ExportTable = {
  name: string;
  filterColumn: "client_id" | "user_id" | "id" | "profile_id";
  filterValue: "clientId" | "profileId";
};

const DIRECT_CLIENT_TABLES: ExportTable[] = [
  { name: "clients", filterColumn: "id", filterValue: "clientId" },
  { name: "client_achievements", filterColumn: "client_id", filterValue: "clientId" },
  { name: "client_companions", filterColumn: "client_id", filterValue: "clientId" },
  { name: "client_measurement_logs", filterColumn: "client_id", filterValue: "clientId" },
  { name: "client_messages", filterColumn: "client_id", filterValue: "clientId" },
  { name: "client_milestones", filterColumn: "client_id", filterValue: "clientId" },
  { name: "client_program_set_logs", filterColumn: "client_id", filterValue: "clientId" },
  { name: "client_programs", filterColumn: "client_id", filterValue: "clientId" },
  { name: "client_streaks", filterColumn: "client_id", filterValue: "clientId" },
  { name: "client_weight_logs", filterColumn: "client_id", filterValue: "clientId" },
  { name: "client_weekly_check_ins", filterColumn: "client_id", filterValue: "clientId" },
  { name: "client_workout_completions", filterColumn: "client_id", filterValue: "clientId" },
  { name: "client_workout_day_progress", filterColumn: "client_id", filterValue: "clientId" },
  { name: "companion_events", filterColumn: "client_id", filterValue: "clientId" },
  { name: "custom_meal_logs", filterColumn: "client_id", filterValue: "clientId" },
  { name: "daily_tracking", filterColumn: "client_id", filterValue: "clientId" },
  { name: "meal_logs", filterColumn: "client_id", filterValue: "clientId" },
  { name: "meal_plans", filterColumn: "client_id", filterValue: "clientId" },
  { name: "progress_photos", filterColumn: "client_id", filterValue: "clientId" },
  { name: "weekly_check_ins", filterColumn: "client_id", filterValue: "clientId" },
  { name: "workout_progress", filterColumn: "client_id", filterValue: "clientId" },
  { name: "workout_set_logs", filterColumn: "client_id", filterValue: "clientId" },
];

const PROFILE_TABLES: ExportTable[] = [
  { name: "profiles", filterColumn: "id", filterValue: "profileId" },
  { name: "feedback", filterColumn: "user_id", filterValue: "profileId" },
  { name: "notifications", filterColumn: "user_id", filterValue: "profileId" },
];

async function requireAdmin(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseKey) {
    return {
      error: NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      ),
    };
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
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
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
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
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { supabaseAdmin, user };
}

function safeFilePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function POST(request: NextRequest) {
  try {
    const adminContext = await requireAdmin(request);

    if ("error" in adminContext) {
      return adminContext.error;
    }

    const { supabaseAdmin, user } = adminContext;
    const { clientId, note } = await request.json();

    if (typeof clientId !== "string" || !clientId) {
      return NextResponse.json({ error: "Missing client id" }, { status: 400 });
    }

    const auditNote =
      typeof note === "string" && note.trim()
        ? note.trim().slice(0, 500)
        : null;

    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select(
        "id, full_name, email, profile_id, marketing_consent_at, marketing_consent_version"
      )
      .eq("id", clientId)
      .maybeSingle();

    if (clientError || !client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const tableExports: Record<string, unknown[] | { error: string }> = {};
    const tables = [
      ...DIRECT_CLIENT_TABLES,
      ...(client.profile_id ? PROFILE_TABLES : []),
    ];

    for (const table of tables) {
      const value = table.filterValue === "clientId" ? clientId : client.profile_id;

      if (!value) continue;

      const { data, error } = await supabaseAdmin
        .from(table.name)
        .select("*")
        .eq(table.filterColumn, value);

      tableExports[table.name] = error
        ? { error: error.message }
        : data ?? [];
    }

    const authUser = client.profile_id
      ? await supabaseAdmin.auth.admin.getUserById(client.profile_id)
      : null;

    const exportPayload = {
      export_type: "gdpr_subject_access_request",
      exported_at: new Date().toISOString(),
      exported_by: user.id,
      client: {
        id: client.id,
        full_name: client.full_name,
        email: client.email,
        profile_id: client.profile_id,
        marketing_consent_at: client.marketing_consent_at,
        marketing_consent_version: client.marketing_consent_version,
      },
      auth_user:
        authUser?.data?.user
          ? {
              id: authUser.data.user.id,
              email: authUser.data.user.email,
              created_at: authUser.data.user.created_at,
              last_sign_in_at: authUser.data.user.last_sign_in_at,
              app_metadata: authUser.data.user.app_metadata,
              user_metadata: authUser.data.user.user_metadata,
            }
          : null,
      tables: tableExports,
      notes: [
        "Progress photo rows include storage paths. The binary image files remain in Supabase Storage until deleted or manually exported.",
        "This export is intended for internal SAR handling and should be shared securely.",
      ],
    };

    const fileName = `sar-${safeFilePart(client.full_name || client.email || client.id)}.json`;

    await recordAdminAuditEvent(supabaseAdmin, {
      eventType: "sar_exported",
      actorProfileId: user.id,
      targetClientId: client.id,
      targetProfileId: client.profile_id,
      metadata: {
        fileName,
        tableCount: Object.keys(tableExports).length,
        note: auditNote,
      },
    });

    return new NextResponse(JSON.stringify(exportPayload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Unhandled error in export-client", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
