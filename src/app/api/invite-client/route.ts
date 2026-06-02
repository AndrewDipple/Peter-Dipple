import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const isStaffRole = (role: string | null | undefined) =>
  role === "trainer" || role === "admin";

const getAppOrigin = (request: NextRequest) => {
  const configuredOrigin =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.APP_ORIGIN ||
    process.env.SITE_URL;

  return (configuredOrigin || request.nextUrl.origin).replace(/\/$/, "");
};

export async function POST(request: NextRequest) {
  try {
    const { fullName, email, licenseTypeId } = await request.json();

    if (!fullName || !email) {
      return NextResponse.json({ error: "Missing name or email" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseKey) {
      console.error("Missing env vars", {
        hasUrl: !!supabaseUrl,
        hasAnonKey: !!supabaseAnonKey,
        hasKey: !!supabaseKey,
      });
      return NextResponse.json(
        { error: "Server configuration error: Missing Supabase credentials" },
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

    const { data: profile, error: profileLookupError } = await supabaseUser
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileLookupError || !isStaffRole(profile?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
    const redirectOrigin = getAppOrigin(request);
    let validatedLicenseTypeId: string | null = null;

    if (licenseTypeId) {
      const { data: licenseType, error: licenseTypeError } = await supabaseAdmin
        .from("license_types")
        .select("id")
        .eq("id", licenseTypeId)
        .eq("is_active", true)
        .maybeSingle();

      if (licenseTypeError || !licenseType) {
        return NextResponse.json(
          { error: "Selected licence type is not available" },
          { status: 400 }
        );
      }

      validatedLicenseTypeId = licenseType.id;
    }

    const { data, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName, role: "client" },
      redirectTo: `${redirectOrigin}/reset-password`,
    });

    if (inviteError || !data.user) {
      console.error("Invite failed", inviteError);
      return NextResponse.json(
        { error: `Invite failed: ${inviteError?.message || "no user returned"}` },
        { status: 500 }
      );
    }

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: data.user.id,
      full_name: fullName,
      role: "client",
    });

    if (profileError) {
      console.error("Profile upsert failed", profileError);
      return NextResponse.json(
        { error: `Profile creation failed: ${profileError.message}` },
        { status: 500 }
      );
    }

    const { error: clientError } = await supabaseAdmin.from("clients").insert({
      full_name: fullName,
      email,
      profile_id: data.user.id,
      onboarding_complete: false,
      license_type_id: validatedLicenseTypeId,
      license_status: "active",
      license_starts_on: new Date().toISOString().split("T")[0],
    });

    if (clientError) {
      console.error("Client insert failed", clientError);
      return NextResponse.json(
        { error: `Client record creation failed: ${clientError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Unhandled error in invite-client", err);
    const message = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { error: `Unexpected error: ${message}` },
      { status: 500 }
    );
  }
}
