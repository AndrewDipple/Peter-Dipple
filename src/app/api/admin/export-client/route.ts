import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { recordAdminAuditEvent } from "@/lib/adminAudit";

const PROGRESS_PHOTOS_BUCKET = "progress-photos";
const SAR_PHOTO_URL_TTL_SECONDS = 60 * 60 * 24;

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

function normalizeProgressPhotoPath(path: unknown) {
  if (typeof path !== "string") return null;
  const trimmed = path.trim();
  if (!trimmed) return null;

  const marker = `/${PROGRESS_PHOTOS_BUCKET}/`;
  const markerIndex = trimmed.indexOf(marker);

  if (markerIndex >= 0) {
    return decodeURIComponent(trimmed.slice(markerIndex + marker.length));
  }

  return trimmed.startsWith("http") ? null : trimmed;
}

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return "";

  const stringValue =
    typeof value === "string" ? value : JSON.stringify(value) ?? String(value);

  return `"${stringValue.replaceAll('"', '""')}"`;
}

function flattenObject(
  value: unknown,
  prefix = ""
): Array<{ field: string; value: unknown }> {
  if (
    value === null ||
    value === undefined ||
    typeof value !== "object" ||
    value instanceof Date
  ) {
    return [{ field: prefix || "value", value }];
  }

  if (Array.isArray(value)) {
    return [{ field: prefix || "value", value }];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, entry]) =>
      flattenObject(entry, prefix ? `${prefix}.${key}` : key)
  );
}

function buildLongFormCsv(payload: {
  export_type: string;
  exported_at: string;
  exported_by: string;
  client: Record<string, unknown>;
  auth_user: Record<string, unknown> | null;
  tables: Record<string, unknown[] | { error: string }>;
  progress_photo_access: {
    expires_in_seconds: number;
    expires_note: string;
    photos: Array<Record<string, unknown>>;
  };
  notes: string[];
}) {
  const rows: string[] = [
    ["section", "row_index", "field", "value"].map(csvEscape).join(","),
  ];

  const addRecord = (
    section: string,
    rowIndex: number,
    record: Record<string, unknown>
  ) => {
    flattenObject(record).forEach(({ field, value }) => {
      rows.push(
        [section, rowIndex, field, value].map(csvEscape).join(",")
      );
    });
  };

  addRecord("export", 0, {
    export_type: payload.export_type,
    exported_at: payload.exported_at,
    exported_by: payload.exported_by,
  });
  addRecord("client", 0, payload.client);
  if (payload.auth_user) addRecord("auth_user", 0, payload.auth_user);

  Object.entries(payload.tables).forEach(([tableName, tableRows]) => {
    if (!Array.isArray(tableRows)) {
      addRecord(`table:${tableName}`, 0, tableRows);
      return;
    }

    if (tableRows.length === 0) {
      addRecord(`table:${tableName}`, 0, { empty: true });
      return;
    }

    tableRows.forEach((row, index) => {
      addRecord(`table:${tableName}`, index + 1, row as Record<string, unknown>);
    });
  });

  addRecord("progress_photo_access", 0, {
    expires_in_seconds: payload.progress_photo_access.expires_in_seconds,
    expires_note: payload.progress_photo_access.expires_note,
  });

  payload.progress_photo_access.photos.forEach((photo, index) => {
    addRecord("progress_photo", index + 1, photo);
  });

  payload.notes.forEach((note, index) => {
    addRecord("note", index + 1, { note });
  });

  return rows.join("\r\n");
}

export async function POST(request: NextRequest) {
  try {
    const adminContext = await requireAdmin(request);

    if ("error" in adminContext) {
      return adminContext.error;
    }

    const { supabaseAdmin, user } = adminContext;
    const { clientId, note, format } = await request.json();
    const exportFormat = format === "csv" ? "csv" : "json";

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

    const { data: progressPhotos } = await supabaseAdmin
      .from("progress_photos")
      .select("id, image_url, storage_path, log_date, note")
      .eq("client_id", clientId)
      .order("log_date", { ascending: false });

    const photoPaths = Array.from(
      new Set(
        (progressPhotos ?? [])
          .map((photo) =>
            normalizeProgressPhotoPath(photo.storage_path ?? photo.image_url)
          )
          .filter((path): path is string => Boolean(path))
      )
    );

    const signedPhotoUrls =
      photoPaths.length > 0
        ? await supabaseAdmin.storage
            .from(PROGRESS_PHOTOS_BUCKET)
            .createSignedUrls(photoPaths, SAR_PHOTO_URL_TTL_SECONDS)
        : null;

    const signedUrlByPath = new Map(
      (signedPhotoUrls?.data ?? [])
        .filter((item) => item.path && item.signedUrl)
        .map((item) => [item.path, item.signedUrl])
    );

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
      progress_photo_access: {
        expires_in_seconds: SAR_PHOTO_URL_TTL_SECONDS,
        expires_note:
          "Progress photo links are temporary. Generate a fresh SAR export if they expire before review.",
        photos: (progressPhotos ?? []).map((photo) => {
          const path = normalizeProgressPhotoPath(
            photo.storage_path ?? photo.image_url
          );

          return {
            id: photo.id,
            log_date: photo.log_date,
            note: photo.note,
            storage_path: path,
            signed_url: path ? signedUrlByPath.get(path) ?? null : null,
          };
        }),
      },
      notes: [
        "Progress photo access links are temporary signed URLs and should be handled securely.",
        "This export is intended for internal SAR handling and should be shared securely.",
      ],
    };

    const fileBaseName = `sar-${safeFilePart(client.full_name || client.email || client.id)}`;
    const fileName = `${fileBaseName}.${exportFormat}`;

    await recordAdminAuditEvent(supabaseAdmin, {
      eventType: "sar_exported",
      actorProfileId: user.id,
      targetClientId: client.id,
      targetProfileId: client.profile_id,
      metadata: {
        fileName,
        format: exportFormat,
        tableCount: Object.keys(tableExports).length,
        progressPhotoCount: progressPhotos?.length ?? 0,
        signedProgressPhotoCount: signedUrlByPath.size,
        note: auditNote,
      },
    });

    if (exportFormat === "csv") {
      return new NextResponse(buildLongFormCsv(exportPayload), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${fileName}"`,
        },
      });
    }

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
