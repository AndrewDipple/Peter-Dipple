import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { fullName, email, origin } = await request.json();

  if (!fullName || !email) {
    return NextResponse.json({ error: "Missing name or email" }, { status: 400 });
  }

  // Debug: Check if env vars exist
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log("Supabase URL:", supabaseUrl ? "✓ Found" : "✗ Missing");
  console.log("Service Role Key:", supabaseKey ? "✓ Found" : "✗ Missing");

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Server configuration error: Missing Supabase credentials" },
      { status: 500 }
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: {
      full_name: fullName,
      role: "client",
    },
    redirectTo: `${origin}/reset-password`,
  });

  if (error || !data.user) {
    return NextResponse.json(
      { error: error?.message || "Could not invite user" },
      { status: 500 }
    );
  }

  await supabaseAdmin.from("profiles").upsert({
    id: data.user.id,
    full_name: fullName,
    role: "client",
  });

  await supabaseAdmin.from("clients").insert({
    full_name: fullName,
    email,
    profile_id: data.user.id,
    onboarding_complete: false,
  });

  return NextResponse.json({ success: true });
}