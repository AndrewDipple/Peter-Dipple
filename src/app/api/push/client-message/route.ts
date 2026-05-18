import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { sendPushToUsers } from "@/lib/serverPush";

export const runtime = "nodejs";

const isStaffRole = (role: string | null | undefined) =>
  role === "trainer" || role === "admin";

type ClientMessage = {
  id: string;
  client_id: string;
  sender_role: "client" | "trainer";
  body: string;
  context_label: string | null;
};

export async function POST(request: NextRequest) {
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

  const { messageId } = await request.json();

  if (typeof messageId !== "string" || !messageId) {
    return NextResponse.json({ error: "Missing message id" }, { status: 400 });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
    },
  });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  const { data: message, error: messageError } = await supabaseAdmin
    .from("client_messages")
    .select("id, client_id, sender_role, body, context_label")
    .eq("id", messageId)
    .maybeSingle<ClientMessage>();

  if (messageError || !message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("id, full_name, profile_id")
    .eq("id", message.client_id)
    .maybeSingle();

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  let recipientUserIds: string[] = [];
  let title = "New message";
  let body = message.body;
  let url = `/messages?client=${client.id}`;

  if (message.sender_role === "client") {
    if (client.profile_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: staffProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .in("role", ["trainer", "admin"]);

    recipientUserIds = (staffProfiles ?? []).map((staff) => staff.id);
    title = `${client.full_name} sent a message`;
    body = message.context_label
      ? `${message.context_label}: ${message.body}`
      : message.body;
  } else {
    if (!isStaffRole(profile?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (client.profile_id) {
      recipientUserIds = [client.profile_id];
    }

    title = "Peter replied";
    body = message.context_label
      ? `${message.context_label}: ${message.body}`
      : message.body;
    url = "/messages";
  }

  const result = await sendPushToUsers(supabaseAdmin, recipientUserIds, {
    title,
    body: body.length > 140 ? `${body.slice(0, 137)}...` : body,
    url,
  });

  return NextResponse.json({ success: true, push: result });
}
