import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { sendPushToUsers } from "@/lib/serverPush";

export const runtime = "nodejs";

type FeedbackRow = {
  id: string;
  user_id: string | null;
  user_name: string | null;
  type: string | null;
  title: string;
  description: string;
};

const formatFeedbackType = (type: string | null | undefined) => {
  if (type === "bug") return "bug report";
  if (type === "feature") return "feature request";
  return "feedback";
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

  const { feedbackId } = await request.json();

  if (typeof feedbackId !== "string" || !feedbackId) {
    return NextResponse.json({ error: "Missing feedback id" }, { status: 400 });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
    },
  });

  const { data: feedback, error: feedbackError } = await supabaseAdmin
    .from("feedback")
    .select("id, user_id, user_name, type, title, description")
    .eq("id", feedbackId)
    .maybeSingle<FeedbackRow>();

  if (feedbackError || !feedback) {
    return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
  }

  if (feedback.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: admins } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("role", "admin");

  const adminUserIds = (admins ?? []).map((admin) => admin.id);
  const feedbackType = formatFeedbackType(feedback.type);
  const reporter = feedback.user_name?.trim() || "A user";
  const body = `${reporter}: ${feedback.title}`;

  const result = await sendPushToUsers(supabaseAdmin, adminUserIds, {
    title: `New ${feedbackType}`,
    body: body.length > 140 ? `${body.slice(0, 137)}...` : body,
    url: "/admin",
  });

  return NextResponse.json({ success: true, push: result });
}
