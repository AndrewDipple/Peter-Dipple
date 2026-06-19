"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Home,
  Dumbbell,
  Apple,
  BarChart3,
  Users,
  ChefHat,
  ClipboardList,
  LogOut,
  MessageSquare,
  MessageCircle,
  Settings,
  Bell,
  Shield,
  PlayCircle,
} from "lucide-react";
import Logo from "./Logo";
import CompanionEvolutionCelebration, {
  type CompanionEvolutionCelebrationData,
} from "./CompanionEvolutionCelebration";
import { useTheme } from "@/contexts/ThemeContext";
import { Role, isAdmin, isStaff } from "@/lib/roles";
import { useClientFeatures } from "@/contexts/ClientFeaturesContext";
import { addDays, getMondayOf, todayStr } from "@/lib/dates";
import { notifyAdminFeedbackPush } from "@/lib/clientPush";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  matches?: string[];
};

const trainerNav: NavItem[] = [
  { href: "/trainer/dashboard", label: "Dashboard", icon: Home },
  { href: "/trainer/clients", label: "Clients", icon: Users },
  { href: "/recipes", label: "Recipes", icon: ChefHat },
  { href: "/trainer/program-templates", label: "Programmes", icon: ClipboardList },
  { href: "/trainer/exercises/new", label: "Exercises", icon: Dumbbell },
  { href: "/trainer/community", label: "Community", icon: MessageCircle },
  { href: "/trainer/analytics", label: "Analytics", icon: BarChart3 },
];

const clientNav: NavItem[] = [
  { href: "/client/dashboard", label: "Home", icon: Home },
  { href: "/client/workout", label: "Workout", icon: Dumbbell },
  {
    href: "/client/nutrition",
    label: "Nutrition",
    icon: Apple,
    matches: ["/client/nutrition", "/client/meal-planner", "/client/shopping-list"],
  },
  { href: "/client/stats", label: "Stats", icon: BarChart3 },
  { href: "/client/community", label: "Community", icon: MessageCircle },
];

type Props = {
  userType: Role;
  children: React.ReactNode;
};

const getFirstPhotoReminderWeek = (weekStart: string, onboardingCompletedAt?: string | null) => {
  if (!onboardingCompletedAt) return weekStart;

  const onboardingDate = onboardingCompletedAt.slice(0, 10);
  const onboardingWeekStart = getMondayOf(onboardingDate);
  const firstFullWeekStart = addDays(onboardingWeekStart, 7);

  return addDays(firstFullWeekStart, 7);
};

export default function AppShell({ userType, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme } = useTheme();
  const { includesNutrition } = useClientFeatures();
  const baseClientNav = isStaff(userType)
    ? trainerNav
    : clientNav.filter((item) => includesNutrition || item.href !== "/client/nutrition");
  const navItems = baseClientNav;
  const dashboardHref = isStaff(userType) ? "/trainer/dashboard" : "/client/dashboard";

  const [menuOpen, setMenuOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<"bug" | "feature">("bug");
  const [feedbackTitle, setFeedbackTitle] = useState("");
  const [feedbackDescription, setFeedbackDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [hasStatsPhotoReminder, setHasStatsPhotoReminder] = useState(false);
  const [companionEvolution, setCompanionEvolution] =
    useState<CompanionEvolutionCelebrationData | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);

  const fetchProfile = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    const { data: clientData } = await supabase
      .from("clients")
      .select("full_name, avatar_url")
      .eq("profile_id", user.id)
      .maybeSingle();

    const name = isStaff(userType)
      ? profileData?.full_name || clientData?.full_name
      : clientData?.full_name || profileData?.full_name;
    const avatar = isStaff(userType)
      ? profileData?.avatar_url || clientData?.avatar_url
      : clientData?.avatar_url || profileData?.avatar_url;

    if (name) {
      setDisplayName(name);
      setAvatarUrl(avatar ?? null);
      return;
    }

    // Fallback: use the email prefix if we can't find a name.
    if (user.email) {
      setDisplayName(user.email.split("@")[0]);
      setAvatarUrl(null);
    }
  }, [userType]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    const handleProfileUpdated = () => {
      fetchProfile();
    };

    window.addEventListener("profile:updated", handleProfileUpdated);
    return () => {
      window.removeEventListener("profile:updated", handleProfileUpdated);
    };
  }, [fetchProfile]);

  useEffect(() => {
    const handleCompanionEvolution = (event: Event) => {
      const customEvent = event as CustomEvent<CompanionEvolutionCelebrationData>;
      setCompanionEvolution(customEvent.detail);
    };

    window.addEventListener("companion:evolved", handleCompanionEvolution);
    return () => {
      window.removeEventListener("companion:evolved", handleCompanionEvolution);
    };
  }, []);

  useEffect(() => {
    const checkNotifications = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", user.id)
        .eq("read", false)
        .limit(1);

      setHasUnreadNotifications(!error && !!data && data.length > 0);
    };

    checkNotifications();

    const channel = supabase
      .channel("notifications-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
        },
        () => {
          checkNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const checkStatsPhotoReminder = async () => {
      if (isStaff(userType)) {
        setHasStatsPhotoReminder(false);
        return;
      }

      const today = todayStr();
      const weekStart = getMondayOf(today);

      if (today !== weekStart) {
        setHasStatsPhotoReminder(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setHasStatsPhotoReminder(false);
        return;
      }

      const { data: clientData } = await supabase
        .from("clients")
        .select("id, onboarding_completed_at, created_at")
        .eq("profile_id", user.id)
        .maybeSingle();

      if (!clientData) {
        setHasStatsPhotoReminder(false);
        return;
      }

      const firstReminderWeek = getFirstPhotoReminderWeek(
        weekStart,
        clientData.onboarding_completed_at ?? clientData.created_at
      );

      if (weekStart < firstReminderWeek) {
        setHasStatsPhotoReminder(false);
        return;
      }

      const { data: photos, error } = await supabase
        .from("progress_photos")
        .select("id")
        .eq("client_id", clientData.id)
        .gte("log_date", weekStart)
        .lte("log_date", addDays(weekStart, 6))
        .limit(1);

      setHasStatsPhotoReminder(!error && (!photos || photos.length === 0));
    };

    checkStatsPhotoReminder();
  }, [userType]);

  const initials =
    displayName
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join("") || "?";

  const firstName = displayName.split(" ")[0] || "";

  const isActive = (item: NavItem) => {
    if (item.matches) return item.matches.some((m) => pathname.startsWith(m));
    return pathname.startsWith(item.href);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleOpenFeedback = () => {
    setMenuOpen(false);
    setFeedbackModalOpen(true);
  };

  const handleOpenSettings = () => {
    setMenuOpen(false);
    router.push("/settings");
  };

  const handleOpenNotifications = () => {
    setMenuOpen(false);
    router.push("/notifications");
  };

  const handleOpenMessages = () => {
    setMenuOpen(false);
    router.push("/messages");
  };

  const handleOpenCommunity = () => {
    setMenuOpen(false);
    router.push(isStaff(userType) ? "/trainer/community" : "/client/community");
  };

  const handleOpenGuides = () => {
    setMenuOpen(false);
    router.push("/client/guides");
  };

  const handleOpenAdmin = () => {
    setMenuOpen(false);
    router.push("/admin");
  };

  const handleOpenPrivacy = () => {
    setMenuOpen(false);
    router.push("/privacy");
  };

  const handleOpenTerms = () => {
    setMenuOpen(false);
    router.push("/terms");
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackTitle.trim() || !feedbackDescription.trim()) {
      alert("Please fill in all fields");
      return;
    }

    setSubmitting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("feedback")
      .insert({
        user_id: user?.id || null,
        user_name: displayName || "Anonymous",
        type: feedbackType,
        title: feedbackTitle.trim(),
        description: feedbackDescription.trim(),
        page_url: window.location.href,
      })
      .select("id")
      .single();

    if (error) {
      alert("Error submitting feedback. Please try again.");
      setSubmitting(false);
      return;
    }

    if (data?.id) {
      notifyAdminFeedbackPush(data.id);
    }

    alert("Thank you for your feedback!");
    setFeedbackModalOpen(false);
    setFeedbackTitle("");
    setFeedbackDescription("");
    setFeedbackType("bug");
    setSubmitting(false);
  };

  return (
    <>
      <header
        className="sticky top-0 z-50 text-white shadow-md dark:text-ink"
        style={{ backgroundColor: theme === "dark" ? "#D4AF37" : "#111111" }}
      >
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-3 px-4 md:px-6">
          <Link href={dashboardHref} className="flex h-full shrink-0 items-center">
            <div className="flex h-16 w-16 items-center">
              <Logo />
            </div>
          </Link>

          <nav className="flex min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:gap-3">
            {navItems.map((item) => {
              const active = isActive(item);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={`relative flex shrink-0 items-center gap-2 px-2 py-2 text-sm font-medium transition-colors lg:px-3 ${
                    active
                      ? theme === "dark"
                        ? "text-navy"
                        : "text-gold"
                      : theme === "dark"
                      ? "text-ink/70 hover:text-ink"
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  <Icon size={20} className="lg:hidden" />
                  <span className="hidden lg:inline">{item.label}</span>
                  {!isStaff(userType) &&
                    item.href === "/client/stats" &&
                    hasStatsPhotoReminder && (
                      <span className="absolute right-0 top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
                    )}
                  {active && <span className="absolute -bottom-4.5 left-0 right-0 h-0.5 bg-gold" />}
                </Link>
              );
            })}
          </nav>

          <div ref={menuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="relative flex items-center gap-3"
            >
              {firstName && <span className="hidden text-sm font-medium md:inline">{firstName}</span>}

              {avatarUrl ? (
                <div className="relative">
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="h-10 w-10 rounded-full object-cover ring-2 ring-gold"
                  />
                  {hasUnreadNotifications && (
                    <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-red-500 ring-2 ring-white" />
                  )}
                </div>
              ) : (
                <div className="relative">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-navy text-sm font-semibold text-white ring-2 ring-gold">
                    {initials}
                  </span>
                  {hasUnreadNotifications && (
                    <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-red-500 ring-2 ring-white" />
                  )}
                </div>
              )}
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-md bg-white text-black shadow-lifted">
                <button
                  type="button"
                  onClick={handleOpenNotifications}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium hover:bg-gray-100"
                >
                  <Bell size={16} />
                  Notifications
                </button>

                <button
                  type="button"
                  onClick={handleOpenMessages}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium hover:bg-gray-100"
                >
                  <MessageSquare size={16} />
                  Messages
                </button>

                <button
                  type="button"
                  onClick={handleOpenCommunity}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium hover:bg-gray-100"
                >
                  <MessageCircle size={16} />
                  Community
                </button>

                {!isStaff(userType) && (
                  <button
                    type="button"
                    onClick={handleOpenGuides}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium hover:bg-gray-100"
                  >
                    <PlayCircle size={16} />
                    Peter&apos;s Guides
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleOpenSettings}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium hover:bg-gray-100"
                >
                  <Settings size={16} />
                  Settings
                </button>

                {isAdmin(userType) && (
                  <button
                    type="button"
                    onClick={handleOpenAdmin}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium hover:bg-gray-100"
                  >
                    <Users size={16} />
                    Admin
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleOpenFeedback}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium hover:bg-gray-100"
                >
                  <MessageSquare size={16} />
                  Report Bug / Request
                </button>

                <button
                  type="button"
                  onClick={handleOpenPrivacy}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium hover:bg-gray-100"
                >
                  <Shield size={16} />
                  Privacy
                </button>

                <button
                  type="button"
                  onClick={handleOpenTerms}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium hover:bg-gray-100"
                >
                  <Shield size={16} />
                  Terms
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium hover:bg-gray-100"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="min-h-[calc(100vh-72px)] bg-surface-base">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">{children}</div>
      </main>

      <CompanionEvolutionCelebration
        celebration={companionEvolution}
        onClose={() => setCompanionEvolution(null)}
      />

      {feedbackModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-lifted">
            <h2 className="text-xl font-semibold text-black">Report Bug / Request Feature</h2>

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-black">Type</label>
                <select
                  value={feedbackType}
                  onChange={(e) => setFeedbackType(e.target.value as "bug" | "feature")}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-black focus:outline-none"
                  style={{ backgroundColor: "#ffffff", color: "#000000" }}
                >
                  <option value="bug">Bug Report</option>
                  <option value="feature">Feature Request</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-black">Title</label>
                <input
                  type="text"
                  value={feedbackTitle}
                  onChange={(e) => setFeedbackTitle(e.target.value)}
                  placeholder="Brief summary"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 placeholder:text-gray-400 focus:border-black focus:outline-none"
                  style={{ backgroundColor: "#ffffff", color: "#000000" }}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-black">Description</label>
                <textarea
                  value={feedbackDescription}
                  onChange={(e) => setFeedbackDescription(e.target.value)}
                  placeholder="Provide details..."
                  rows={6}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 placeholder:text-gray-400 focus:border-black focus:outline-none"
                  style={{ backgroundColor: "#ffffff", color: "#000000" }}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSubmitFeedback}
                  disabled={submitting}
                  className="flex-1 rounded-md bg-black px-4 py-2.5 font-semibold text-white transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit"}
                </button>

                <button
                  onClick={() => {
                    setFeedbackModalOpen(false);
                    setFeedbackTitle("");
                    setFeedbackDescription("");
                    setFeedbackType("bug");
                  }}
                  className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2.5 font-medium text-black transition hover:bg-gray-100"
                >
Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}



