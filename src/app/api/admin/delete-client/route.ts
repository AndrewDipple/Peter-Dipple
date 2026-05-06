import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { recordAdminAuditEvent } from "@/lib/adminAudit";

const PROGRESS_PHOTOS_BUCKET = "progress-photos";

const isAdminRole = (role: string | null | undefined) => role === "admin";

function normalizeStoragePath(path: unknown) {
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

    const { clientId } = await request.json();

    if (typeof clientId !== "string" || !clientId) {
      return NextResponse.json({ error: "Missing client id" }, { status: 400 });
    }

    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("id, profile_id")
      .eq("id", clientId)
      .maybeSingle();

    if (clientError || !client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const { data: photos, error: photoError } = await supabaseAdmin
      .from("progress_photos")
      .select("image_url, storage_path")
      .eq("client_id", clientId);

    if (photoError) {
      return NextResponse.json(
        { error: "Could not load client photos" },
        { status: 500 }
      );
    }

    const photoPaths = Array.from(
      new Set(
        (photos ?? [])
          .map((photo) => normalizeStoragePath(photo.storage_path ?? photo.image_url))
          .filter((path): path is string => Boolean(path))
      )
    );

    const { error: deleteError } = await supabaseAdmin.rpc(
      "admin_delete_client_data",
      { target_client_id: clientId }
    );

    if (deleteError) {
      console.error("Client delete RPC failed", deleteError);
      return NextResponse.json(
        { error: "Could not delete client data" },
        { status: 500 }
      );
    }

    if (photoPaths.length > 0) {
      const { error: storageError } = await supabaseAdmin.storage
        .from(PROGRESS_PHOTOS_BUCKET)
        .remove(photoPaths);

      if (storageError) {
        return NextResponse.json(
          { error: "Client data was deleted, but progress photos could not be removed" },
          { status: 500 }
        );
      }
    }

    if (client.profile_id) {
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(
        client.profile_id
      );

      if (authDeleteError) {
        return NextResponse.json(
          {
            error:
              "Client data was deleted, but the auth user could not be removed",
          },
          { status: 500 }
        );
      }
    }

    await recordAdminAuditEvent(supabaseAdmin, {
      eventType: "client_deleted",
      actorProfileId: user.id,
      targetClientId: clientId,
      targetProfileId: client.profile_id,
      metadata: {
        deletedPhotoCount: photoPaths.length,
        authUserDeleted: Boolean(client.profile_id),
      },
    });

    return NextResponse.json({
      success: true,
      deletedPhotoCount: photoPaths.length,
    });
  } catch (error) {
    console.error("Unhandled error in delete-client", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
