import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const PROGRESS_PHOTOS_BUCKET = "progress-photos";
const SIGNED_URL_TTL_SECONDS = 60 * 15;

const isStaffRole = (role: string | null | undefined) =>
  role === "trainer" || role === "admin";

type ProgressPhotoRow = {
  client_id: string;
  image_url: string | null;
  storage_path: string | null;
  clients: { profile_id: string | null } | { profile_id: string | null }[] | null;
};

type ClientOwnerRow = {
  id: string;
  profile_id: string | null;
};

function normalizePath(path: unknown) {
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

function getClientIdFromPath(path: string) {
  return path.split("/")[0] || null;
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

    const { paths: rawPaths } = await request.json();
    const paths = Array.from(
      new Set(
        (Array.isArray(rawPaths) ? rawPaths : [])
          .map(normalizePath)
          .filter((path): path is string => Boolean(path))
      )
    );

    if (paths.length === 0) {
      return NextResponse.json({ urls: {} });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
      },
    });

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const isStaff = isStaffRole(profile?.role);
    const allowedPaths = new Set<string>();

    if (isStaff) {
      for (const path of paths) {
        allowedPaths.add(path);
      }
    } else {
      const clientIds = Array.from(
        new Set(
          paths
            .map(getClientIdFromPath)
            .filter((clientId): clientId is string => Boolean(clientId))
        )
      );

      if (clientIds.length > 0) {
        const { data: ownedClients } = await supabaseAdmin
          .from("clients")
          .select("id, profile_id")
          .in("id", clientIds)
          .eq("profile_id", user.id);

        const ownedClientIds = new Set(
          ((ownedClients ?? []) as ClientOwnerRow[]).map((client) => client.id)
        );

        for (const path of paths) {
          const clientId = getClientIdFromPath(path);

          if (clientId && ownedClientIds.has(clientId)) {
            allowedPaths.add(path);
          }
        }
      }
    }

    const unmatchedPaths = paths.filter((path) => !allowedPaths.has(path));
    let photoRows: unknown[] = [];

    if (unmatchedPaths.length > 0) {
      const [storagePathRows, imageUrlRows] = await Promise.all([
        supabaseAdmin
          .from("progress_photos")
          .select("client_id, image_url, storage_path, clients(profile_id)")
          .in("storage_path", unmatchedPaths),
        supabaseAdmin
          .from("progress_photos")
          .select("client_id, image_url, storage_path, clients(profile_id)")
          .in("image_url", unmatchedPaths),
      ]);

      if (storagePathRows.error || imageUrlRows.error) {
        return NextResponse.json({ error: "Could not load photos" }, { status: 500 });
      }

      photoRows = [
        ...(storagePathRows.data ?? []),
        ...(imageUrlRows.data ?? []),
      ];
    }

    for (const row of (photoRows ?? []) as ProgressPhotoRow[]) {
      const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
      const rowPath = normalizePath(row.storage_path ?? row.image_url);

      if (!rowPath) continue;

      if (client?.profile_id === user.id) {
        allowedPaths.add(rowPath);
      }
    }

    if (allowedPaths.size === 0) {
      return NextResponse.json({ urls: {} });
    }

    const { data: signedUrls, error: signedError } = await supabaseAdmin.storage
      .from(PROGRESS_PHOTOS_BUCKET)
      .createSignedUrls(Array.from(allowedPaths), SIGNED_URL_TTL_SECONDS);

    if (signedError) {
      return NextResponse.json({ error: "Could not sign photos" }, { status: 500 });
    }

    const urls = Object.fromEntries(
      (signedUrls ?? [])
        .filter((item) => item.path && item.signedUrl)
        .map((item) => [item.path, item.signedUrl])
    );

    return NextResponse.json({ urls });
  } catch (error) {
    console.error("Unhandled error in progress-photo-urls", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
