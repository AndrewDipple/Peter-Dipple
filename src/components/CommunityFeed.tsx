"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Heart, MessageCircle, Send, ShieldCheck, Trash2, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { styles } from "@/lib/design";
import { isStaff } from "@/lib/roles";
import { notifyCommunityPush } from "@/lib/clientPush";

type Client = {
  id: string;
  full_name: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  role: string | null;
};

type CommunitySettings = {
  id: string;
  client_id: string;
  display_name: string;
  opted_in: boolean;
  opted_in_at: string | null;
  opted_out_at: string | null;
};

type CommunityPost = {
  id: string;
  client_id: string;
  display_name: string;
  category: CommunityCategory;
  body: string;
  status: CommunityStatus;
  created_at: string;
};

type CommunityReply = {
  id: string;
  post_id: string;
  client_id: string | null;
  staff_user_id: string | null;
  display_name: string;
  body: string;
  status: CommunityStatus;
  created_at: string;
};

type CommunityReaction = {
  id: string;
  post_id: string;
  client_id: string | null;
  staff_user_id: string | null;
  reaction: "support";
};

type CommunityCategory = "general" | "win" | "meal" | "question" | "companion";
type CommunityStatus = "published" | "hidden" | "deleted";
type ModerationFilter = "published" | "hidden" | "deleted" | "all";

const categories: Array<{ value: CommunityCategory; label: string }> = [
  { value: "general", label: "General" },
  { value: "win", label: "Win" },
  { value: "meal", label: "Meal idea" },
  { value: "question", label: "Question" },
  { value: "companion", label: "Companion" },
];

const categoryStyles: Record<CommunityCategory, string> = {
  general: "bg-surface-sunken text-ink-muted",
  win: "bg-gold/15 text-gold",
  meal: "bg-emerald/10 text-emerald",
  question: "bg-navy/10 text-navy dark:bg-gold/15 dark:text-gold",
  companion: "bg-emerald/10 text-emerald",
};

const moderationFilters: Array<{ value: ModerationFilter; label: string }> = [
  { value: "published", label: "Published" },
  { value: "hidden", label: "Hidden" },
  { value: "deleted", label: "Removed" },
  { value: "all", label: "All" },
];

const statusStyles: Record<CommunityStatus, string> = {
  published: "bg-emerald/10 text-emerald",
  hidden: "bg-gold/15 text-gold",
  deleted: "bg-red-50 text-red-700",
};

function CommunitySkeleton() {
  return (
    <div className="mt-6 space-y-4" aria-label="Loading community">
      {[0, 1, 2].map((item) => (
        <div key={item} className={styles.card}>
          <div className="flex items-center justify-between">
            <div className="h-4 w-32 animate-pulse rounded-md bg-surface-sunken" />
            <div className="h-5 w-20 animate-pulse rounded-full bg-surface-sunken" />
          </div>
          <div className="mt-4 h-4 w-full animate-pulse rounded-md bg-surface-sunken" />
          <div className="mt-2 h-4 w-2/3 animate-pulse rounded-md bg-surface-sunken" />
        </div>
      ))}
    </div>
  );
}

const getDefaultDisplayName = (name: string | null | undefined) => {
  const firstName = name?.trim().split(/\s+/)[0];
  return firstName && firstName.length >= 2 ? firstName : "Member";
};

const formatPostDate = (value: string) =>
  new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function CommunityFeed() {
  const [client, setClient] = useState<Client | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<CommunitySettings | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [repliesByPost, setRepliesByPost] = useState<Record<string, CommunityReply[]>>({});
  const [reactionsByPost, setReactionsByPost] = useState<
    Record<string, CommunityReaction[]>
  >({});
  const [displayName, setDisplayName] = useState("");
  const [postBody, setPostBody] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [category, setCategory] = useState<CommunityCategory>("general");
  const [moderationFilter, setModerationFilter] =
    useState<ModerationFilter>("published");
  const [postCounts, setPostCounts] = useState<Record<CommunityStatus, number>>({
    published: 0,
    hidden: 0,
    deleted: 0,
  });
  const [loading, setLoading] = useState(true);
  const [savingOptIn, setSavingOptIn] = useState(false);
  const [posting, setPosting] = useState(false);
  const [replyingPostId, setReplyingPostId] = useState<string | null>(null);
  const [reactingPostId, setReactingPostId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const isOptedIn = Boolean(settings?.opted_in);
  const isStaffUser = isStaff(profile?.role);
  const canReadFeed = isStaffUser || isOptedIn;
  const remainingCharacters = 600 - postBody.length;

  const loadFeed = useCallback(async (staffView = false, filter: ModerationFilter = "published") => {
    let postQuery = supabase
      .from("community_posts")
      .select("id, client_id, display_name, category, body, status, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!staffView || filter !== "all") {
      postQuery = postQuery.eq("status", staffView ? filter : "published");
    }

    const { data, error } = await postQuery;

    if (!error) {
      const typedPosts = (data ?? []) as CommunityPost[];
      setPosts(typedPosts);

      const postIds = typedPosts.map((post) => post.id);
      if (postIds.length === 0) {
        setRepliesByPost({});
        setReactionsByPost({});
        return;
      }

      const [replyRes, reactionRes] = await Promise.all([
        supabase
          .from("community_post_replies")
          .select("id, post_id, client_id, staff_user_id, display_name, body, status, created_at")
          .in("post_id", postIds)
          .order("created_at", { ascending: true }),
        supabase
          .from("community_post_reactions")
          .select("id, post_id, client_id, staff_user_id, reaction")
          .in("post_id", postIds),
      ]);

      const groupedReplies: Record<string, CommunityReply[]> = {};
      ((replyRes.data ?? []) as CommunityReply[])
        .filter((reply) => staffView || reply.status === "published")
        .forEach((reply) => {
        groupedReplies[reply.post_id] ??= [];
        groupedReplies[reply.post_id].push(reply);
      });
      setRepliesByPost(groupedReplies);

      const groupedReactions: Record<string, CommunityReaction[]> = {};
      ((reactionRes.data ?? []) as CommunityReaction[]).forEach((reaction) => {
        groupedReactions[reaction.post_id] ??= [];
        groupedReactions[reaction.post_id].push(reaction);
      });
      setReactionsByPost(groupedReactions);
    }
  }, []);

  const loadModerationCounts = useCallback(async () => {
    const { data, error } = await supabase
      .from("community_posts")
      .select("status");

    if (error) return;

    const counts: Record<CommunityStatus, number> = {
      published: 0,
      hidden: 0,
      deleted: 0,
    };

    ((data ?? []) as Array<{ status: CommunityStatus | null }>).forEach((row) => {
      if (row.status && row.status in counts) {
        counts[row.status] += 1;
      }
    });

    setPostCounts(counts);
  }, []);

  const loadPage = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", user.id)
      .maybeSingle();

    const typedProfile = (profileData ?? null) as Profile | null;
    setProfile(typedProfile);

    const { data: clientData } = await supabase
      .from("clients")
      .select("id, full_name")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (isStaff(typedProfile?.role)) {
      const staffName = typedProfile?.full_name?.trim() || "Peter";
      setDisplayName(staffName);
      await Promise.all([
        loadFeed(true, moderationFilter),
        loadModerationCounts(),
      ]);
      setLoading(false);
      return;
    }

    if (!clientData) {
      setLoading(false);
      return;
    }

    const typedClient = clientData as Client;
    setClient(typedClient);

    const { data: settingsData } = await supabase
      .from("client_community_settings")
      .select("id, client_id, display_name, opted_in, opted_in_at, opted_out_at")
      .eq("client_id", typedClient.id)
      .maybeSingle();

    const typedSettings = (settingsData ?? null) as CommunitySettings | null;
    setSettings(typedSettings);
    setDisplayName(
      typedSettings?.display_name || getDefaultDisplayName(typedClient.full_name)
    );

    if (typedSettings?.opted_in) {
      await loadFeed(false, "published");
    }

    setLoading(false);
  }, [loadFeed, loadModerationCounts, moderationFilter]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const canPost = useMemo(
    () => postBody.trim().length >= 2 && postBody.trim().length <= 600 && isOptedIn,
    [isOptedIn, postBody]
  );

  const getMyReaction = (postId: string) =>
    (reactionsByPost[postId] ?? []).find((reaction) =>
      isStaffUser
        ? reaction.staff_user_id === profile?.id
        : reaction.client_id === client?.id
    );

  const handleOptIn = async () => {
    if (!client) return;

    const trimmedName = displayName.trim();
    if (trimmedName.length < 2 || trimmedName.length > 40) {
      setMessage("Choose a display name between 2 and 40 characters.");
      return;
    }

    setSavingOptIn(true);
    setMessage("");

    if (settings) {
      const { data, error } = await supabase
        .from("client_community_settings")
        .update({
          display_name: trimmedName,
          opted_in: true,
          opted_in_at: new Date().toISOString(),
          opted_out_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", settings.id)
        .select("id, client_id, display_name, opted_in, opted_in_at, opted_out_at")
        .single();

      if (error) {
        setMessage("Could not join the community yet.");
        setSavingOptIn(false);
        return;
      }

      setSettings(data as CommunitySettings);
    } else {
      const { data, error } = await supabase
        .from("client_community_settings")
        .insert({
          client_id: client.id,
          display_name: trimmedName,
          opted_in: true,
          opted_in_at: new Date().toISOString(),
        })
        .select("id, client_id, display_name, opted_in, opted_in_at, opted_out_at")
        .single();

      if (error) {
        setMessage("Could not join the community yet.");
        setSavingOptIn(false);
        return;
      }

      setSettings(data as CommunitySettings);
    }

    await loadFeed();
    setMessage("Community enabled.");
    setSavingOptIn(false);
  };

  const handleOptOut = async () => {
    if (!settings || !client) return;
    if (!window.confirm("Leave the community feed? Your existing posts will be hidden.")) {
      return;
    }

    setSavingOptIn(true);
    setMessage("");

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("client_community_settings")
      .update({
        opted_in: false,
        opted_out_at: now,
        updated_at: now,
      })
      .eq("id", settings.id);

    if (error) {
      setMessage("Could not leave the community yet.");
      setSavingOptIn(false);
      return;
    }

    await supabase
      .from("community_posts")
      .update({ status: "hidden", hidden_at: now, updated_at: now })
      .eq("client_id", client.id)
      .eq("status", "published");

    setSettings({ ...settings, opted_in: false, opted_out_at: now });
    setPosts([]);
    setMessage("Community disabled and your posts were hidden.");
    setSavingOptIn(false);
  };

  const handleCreatePost = async () => {
    if (!client || !settings || !canPost) return;

    setPosting(true);
    setMessage("");

    const trimmedBody = postBody.trim();
    const { error } = await supabase.from("community_posts").insert({
      client_id: client.id,
      display_name: settings.display_name,
      category,
      body: trimmedBody,
      status: "published",
    });

    if (error) {
      setMessage("Could not share that post yet.");
      setPosting(false);
      return;
    }

    setPostBody("");
    setCategory("general");
    await loadFeed();
    setPosting(false);
  };

  const handleCreateReply = async (postId: string) => {
    const trimmedBody = (replyDrafts[postId] ?? "").trim();
    if (trimmedBody.length < 2 || trimmedBody.length > 400) return;
    if (!client && !isStaffUser) return;

    setReplyingPostId(postId);
    setMessage("");

    const authorName = isStaffUser
      ? displayName.trim() || "Peter"
      : settings?.display_name ?? displayName.trim();

    const payload = isStaffUser
      ? {
          post_id: postId,
          staff_user_id: profile?.id,
          display_name: authorName,
          body: trimmedBody,
          status: "published",
        }
      : {
          post_id: postId,
          client_id: client?.id,
          display_name: authorName,
          body: trimmedBody,
          status: "published",
        };

    const { data, error } = await supabase
      .from("community_post_replies")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      setMessage("Could not add that reply yet.");
      setReplyingPostId(null);
      return;
    }

    if (data?.id) {
      notifyCommunityPush("reply", data.id);
    }

    setReplyDrafts((current) => ({ ...current, [postId]: "" }));
    await loadFeed();
    setReplyingPostId(null);
  };

  const handleToggleReaction = async (postId: string) => {
    if (!client && !isStaffUser) return;

    setReactingPostId(postId);
    setMessage("");

    const existing = getMyReaction(postId);
    if (existing) {
      const { error } = await supabase
        .from("community_post_reactions")
        .delete()
        .eq("id", existing.id);

      if (error) setMessage("Could not update that reaction.");
    } else {
      const payload = isStaffUser
        ? { post_id: postId, staff_user_id: profile?.id, reaction: "support" }
        : { post_id: postId, client_id: client?.id, reaction: "support" };

      const { data, error } = await supabase
        .from("community_post_reactions")
        .insert(payload)
        .select("id")
        .single();
      if (error) setMessage("Could not add that reaction.");
      if (data?.id) notifyCommunityPush("reaction", data.id);
    }

    await loadFeed();
    setReactingPostId(null);
  };

  const refreshStaffFeed = async () => {
    await Promise.all([
      loadFeed(isStaffUser, isStaffUser ? moderationFilter : "published"),
      isStaffUser ? loadModerationCounts() : Promise.resolve(),
    ]);
  };

  const handleModeratePost = async (
    postId: string,
    nextStatus: CommunityStatus
  ) => {
    const actionLabel =
      nextStatus === "published"
        ? "restore"
        : nextStatus === "hidden"
          ? "hide"
          : "remove";
    if (!window.confirm(`${actionLabel.charAt(0).toUpperCase()}${actionLabel.slice(1)} this post?`)) {
      return;
    }

    const { error } = await supabase
      .from("community_posts")
      .update({
        status: nextStatus,
        hidden_at: nextStatus === "published" ? null : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId);

    if (error) {
      setMessage("Could not remove that post.");
      return;
    }

    await refreshStaffFeed();
  };

  const handleDeletePost = async (postId: string) => {
    await handleModeratePost(postId, "deleted");
  };

  const handleDeleteReply = async (replyId: string) => {
    if (!window.confirm("Remove this reply from the community feed?")) return;

    const { error } = await supabase
      .from("community_post_replies")
      .update({
        status: "deleted",
        hidden_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", replyId);

    if (error) {
      setMessage("Could not remove that reply.");
      return;
    }

    await refreshStaffFeed();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-gold">
            Community
          </p>
          <h1 className={styles.display}>Client Feed</h1>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-surface-sunken px-4 py-2 text-sm text-ink-muted">
          <ShieldCheck size={16} className="text-emerald" />
          Opt-in only
        </div>
      </div>

      {!isStaffUser && (
      <div className={styles.card}>
        <div className="flex items-start gap-3">
          <Users className="mt-1 text-gold" size={22} />
          <div>
            <h2 className={styles.h2}>Share wins, ideas, and questions</h2>
            <p className="mt-2 text-sm text-ink-muted">
              This feed is only visible to clients who choose to join it. Use a
              display name you are comfortable with, avoid sharing sensitive
              personal details, and keep it supportive.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <label className="text-sm font-medium text-ink">
            Display name
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={40}
              disabled={savingOptIn}
              className={styles.input}
              placeholder="How you want to appear"
            />
          </label>

          {isOptedIn ? (
            <button
              type="button"
              onClick={handleOptOut}
              disabled={savingOptIn}
              className={styles.buttonSecondary}
            >
              {savingOptIn ? "Updating..." : "Leave feed"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleOptIn}
              disabled={savingOptIn}
              className={styles.buttonPrimary}
            >
              {savingOptIn ? "Joining..." : "Join feed"}
            </button>
          )}
        </div>

        {message && <p className="mt-3 text-sm font-medium text-ink">{message}</p>}
      </div>
      )}

      {isStaffUser && (
        <div className={styles.card}>
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 text-emerald" size={22} />
            <div>
              <h2 className={styles.h2}>Trainer view</h2>
              <p className="mt-2 text-sm text-ink-muted">
                You can view the client community, react to posts, reply, and
                remove anything unsuitable. Top-level posts stay client-led for now.
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {moderationFilters.map((filter) => {
              const count =
                filter.value === "all"
                  ? postCounts.published + postCounts.hidden + postCounts.deleted
                  : postCounts[filter.value];
              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => {
                    setModerationFilter(filter.value);
                    loadFeed(true, filter.value);
                  }}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                    moderationFilter === filter.value
                      ? "bg-gold text-ink"
                      : "bg-surface-sunken text-ink-muted hover:text-ink"
                  }`}
                >
                  {filter.label} {count}
                </button>
              );
            })}
          </div>
          {message && <p className="mt-3 text-sm font-medium text-ink">{message}</p>}
        </div>
      )}

      {loading ? (
        <CommunitySkeleton />
      ) : !client && !isStaffUser ? (
        <div className={styles.card}>
          <p className={styles.body}>Client profile not found.</p>
        </div>
      ) : !canReadFeed ? (
        <div className="rounded-lg border border-dashed border-border-subtle bg-surface-raised p-8 text-center">
          <MessageCircle className="mx-auto text-gold" size={34} />
          <h2 className="mt-3 text-xl font-semibold text-ink">
            Join when you are ready
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-ink-muted">
            Once joined, you can read the client feed and share short updates.
            Leaving later hides your posts from the feed.
          </p>
        </div>
      ) : (
        <>
          {!isStaffUser && (
          <div className={styles.card}>
            <div className="flex items-center gap-2">
              <MessageCircle className="text-gold" size={20} />
              <h2 className={styles.h2}>Share an update</h2>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {categories.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setCategory(item.value)}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                    category === item.value
                      ? "bg-gold text-ink"
                      : "bg-surface-sunken text-ink-muted hover:text-ink"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <textarea
              value={postBody}
              onChange={(event) => setPostBody(event.target.value.slice(0, 600))}
              className={`${styles.textarea} mt-4 min-h-28`}
              placeholder="Share a win, a recipe idea, a useful tip, or a question for the group."
            />

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p
                className={`text-sm ${
                  remainingCharacters < 0 ? "text-red-600" : "text-ink-muted"
                }`}
              >
                {remainingCharacters} characters left
              </p>
              <button
                type="button"
                onClick={handleCreatePost}
                disabled={posting || !canPost}
                className={`${styles.buttonPrimary} inline-flex items-center justify-center gap-2 disabled:opacity-50`}
              >
                <Send size={16} />
                {posting ? "Sharing..." : "Share"}
              </button>
            </div>
          </div>
          )}

          <div className="space-y-4">
            {posts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border-subtle bg-surface-raised p-8 text-center">
                <p className="text-sm text-ink-muted">
                  No posts yet. A small first post is welcome.
                </p>
              </div>
            ) : (
              posts.map((post) => (
                <article key={post.id} className={styles.card}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{post.display_name}</p>
                      <p className="mt-1 text-xs text-ink-muted">
                        {formatPostDate(post.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          categoryStyles[post.category]
                        }`}
                      >
                        {categories.find((item) => item.value === post.category)?.label ??
                          "General"}
                      </span>
                      {isStaffUser && (
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            statusStyles[post.status]
                          }`}
                        >
                          {post.status}
                        </span>
                      )}
                      {post.client_id === client?.id && !isStaffUser && (
                        <button
                          type="button"
                          onClick={() => handleDeletePost(post.id)}
                          className="rounded-full p-2 text-ink-muted transition hover:bg-surface-sunken hover:text-red-600"
                          aria-label="Remove post"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-ink">
                    {post.body}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-4">
                    <button
                      type="button"
                      onClick={() => handleToggleReaction(post.id)}
                      disabled={reactingPostId === post.id}
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                        getMyReaction(post.id)
                          ? "bg-gold/15 text-gold"
                          : "bg-surface-sunken text-ink-muted hover:text-ink"
                      }`}
                    >
                      <Heart size={15} />
                      Support
                      {(reactionsByPost[post.id]?.length ?? 0) > 0
                        ? ` ${reactionsByPost[post.id].length}`
                        : ""}
                    </button>
                    {isStaffUser && post.status !== "hidden" && (
                      <button
                        type="button"
                        onClick={() => handleModeratePost(post.id, "hidden")}
                        className={styles.buttonSecondary}
                      >
                        Hide
                      </button>
                    )}
                    {isStaffUser && post.status !== "published" && (
                      <button
                        type="button"
                        onClick={() => handleModeratePost(post.id, "published")}
                        className={styles.buttonSecondary}
                      >
                        Restore
                      </button>
                    )}
                    {isStaffUser && post.status !== "deleted" && (
                      <button
                        type="button"
                        onClick={() => handleDeletePost(post.id)}
                        className="rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-100"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {(repliesByPost[post.id]?.length ?? 0) > 0 && (
                    <div className="mt-4 space-y-3">
                      {repliesByPost[post.id].map((reply) => (
                        <div
                          key={reply.id}
                          className="rounded-lg bg-surface-sunken p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-ink">
                                {reply.display_name}
                              </p>
                              <p className="text-xs text-ink-muted">
                                {formatPostDate(reply.created_at)}
                                {isStaffUser && reply.status !== "published"
                                  ? ` - ${reply.status}`
                                  : ""}
                              </p>
                            </div>
                            {isStaffUser && reply.status === "published" && (
                              <button
                                type="button"
                                onClick={() => handleDeleteReply(reply.id)}
                                className="rounded-full p-1.5 text-ink-muted transition hover:bg-surface-raised hover:text-red-600"
                                aria-label="Remove reply"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-ink">
                            {reply.body}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
                    <input
                      type="text"
                      value={replyDrafts[post.id] ?? ""}
                      onChange={(event) =>
                        setReplyDrafts((current) => ({
                          ...current,
                          [post.id]: event.target.value.slice(0, 400),
                        }))
                      }
                      className={styles.input}
                      placeholder="Write a supportive reply"
                    />
                    <button
                      type="button"
                      onClick={() => handleCreateReply(post.id)}
                      disabled={
                        replyingPostId === post.id ||
                        (replyDrafts[post.id] ?? "").trim().length < 2
                      }
                      className={`${styles.buttonSecondary} inline-flex items-center justify-center gap-2 disabled:opacity-50`}
                    >
                      <Send size={15} />
                      Reply
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
