import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { fullName, email, origin } = await request.json();

    if (!fullName || !email) {
      return NextResponse.json({ error: "Missing name or email" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing env vars", {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey,
      });
      return NextResponse.json(
        { error: "Server configuration error: Missing Supabase credentials" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    const { data, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName, role: "client" },
      redirectTo: `${origin}/reset-password`,
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
    });

    if (clientError) {
      console.error("Client insert failed", clientError);
      return NextResponse.json(
        { error: `Client record creation failed: ${clientError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Unhandled error in invite-client", err);
    return NextResponse.json(
      { error: `Unexpected error: ${err?.message || "unknown"}` },
      { status: 500 }
    );
  }
}