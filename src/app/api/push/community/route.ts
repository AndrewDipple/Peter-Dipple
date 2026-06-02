import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { sendPushToUsers } from "@/lib/serverPush";

export const runtime = "nodejs";

type CommunityPost = {
  id: string;
  client_id: string;
  body: string;
  status: string;
};

type ClientRow = {
  id: string;
  profile_id: string | null;
};

type CommunityReply = {
  id: string;
  post_id: string;
  client_id: string | null;
  staff_user_id: string | null;
  display_name: string;
  body: string;
  status: string;
};

type CommunityReaction = {
  id: string;
  post_id: string;
  client_id: string | null;
  staff_user_id: string | null;
};

const isStaffRole = (role: string | null | undefined) =>
  role === "trainer" || role === "admin";

const truncate = (value: string, max = 140) =>
  value.length > max ? `${value.slice(0, max - 3)}...` : value;

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

  const { type, id } = await request.json();
  if ((type !== "reply" && type !== "reaction") || typeof id !== "string") {
    return NextResponse.json({ error: "Invalid community event" }, { status: 400 });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
    },
  });

  const [{ data: actorProfile }, { data: actorClient }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", user.id)
      .maybeSingle(),
    supabaseAdmin
      .from("clients")
      .select("id, full_name, profile_id")
      .eq("profile_id", user.id)
      .maybeSingle(),
  ]);

  const actorIsStaff = isStaffRole(actorProfile?.role);
  let postId: string;
  let actorClientId: string | null = null;
  let actorStaffId: string | null = null;
  let actorName = actorProfile?.full_name?.trim() || actorClient?.full_name?.trim() || "Someone";
  let notificationBody = "";

  if (type === "reply") {
    const { data: reply, error: replyError } = await supabaseAdmin
      .from("community_post_replies")
      .select("id, post_id, client_id, staff_user_id, display_name, body, status")
      .eq("id", id)
      .maybeSingle<CommunityReply>();

    if (replyError || !reply || reply.status !== "published") {
      return NextResponse.json({ error: "Reply not found" }, { status: 404 });
    }

    actorClientId = reply.client_id;
    actorStaffId = reply.staff_user_id;
    actorName = reply.display_name?.trim() || actorName;
    postId = reply.post_id;
    notificationBody = `${actorName}: ${reply.body}`;
  } else {
    const { data: reaction, error: reactionError } = await supabaseAdmin
      .from("community_post_reactions")
      .select("id, post_id, client_id, staff_user_id")
      .eq("id", id)
      .maybeSingle<CommunityReaction>();

    if (reactionError || !reaction) {
      return NextResponse.json({ error: "Reaction not found" }, { status: 404 });
    }

    actorClientId = reaction.client_id;
    actorStaffId = reaction.staff_user_id;
    postId = reaction.post_id;
    notificationBody = `${actorName} supported your community post.`;
  }

  const actorMatches =
    (actorClientId && actorClient?.id === actorClientId) ||
    (actorStaffId && actorIsStaff && actorStaffId === user.id);

  if (!actorMatches) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: post, error: postError } = await supabaseAdmin
    .from("community_posts")
    .select("id, client_id, body, status")
    .eq("id", postId)
    .maybeSingle<CommunityPost>();

  if (postError || !post || post.status !== "published") {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (actorClientId && actorClientId === post.client_id) {
    return NextResponse.json({ success: true, push: { sent: 0, failed: 0, skipped: true } });
  }

  const { data: postOwner } = await supabaseAdmin
    .from("clients")
    .select("id, profile_id")
    .eq("id", post.client_id)
    .maybeSingle<ClientRow>();

  if (!postOwner?.profile_id) {
    return NextResponse.json({ success: true, push: { sent: 0, failed: 0, skipped: true } });
  }

  const result = await sendPushToUsers(supabaseAdmin, [postOwner.profile_id], {
    title: type === "reply" ? "New community reply" : "Community support",
    body: truncate(notificationBody),
    url: "/client/community",
  });

  return NextResponse.json({ success: true, push: result });
}
