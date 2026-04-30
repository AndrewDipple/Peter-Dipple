"use client";

import { useEffect, useState, useRef } from "react";
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
} from "lucide-react";
import Logo from "./Logo";
import { styles } from "@/lib/design";
import NotificationBell from "./NotificationBell";


type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  /** Match these path prefixes for "active" state.
   *  e.g. "/client/nutrition" should be active when on
   *  /client/nutrition, /client/meal-planner, /client/shopping-list */
  matches?: string[];
};

const trainerNav: NavItem[] = [
  { href: "/trainer/dashboard", label: "Dashboard", icon: Home },
  { href: "/trainer/clients", label: "Clients", icon: Users },
  { href: "/trainer/recipes", label: "Recipes", icon: ChefHat },
  {
    href: "/trainer/program-templates",
    label: "Programmes",
    icon: ClipboardList,
  },
  { href: "/trainer/analytics", label: "Analytics", icon: BarChart3 }, // ADD THIS
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
];

type Props = {
  userType: "client" | "trainer";
  children: React.ReactNode;
};

export default function AppShell({ userType, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const navItems = userType === "trainer" ? trainerNav : clientNav;

  const [menuOpen, setMenuOpen] = useState(false);
  const [displayName, setDisplayName] = useState<string>("");
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<"bug" | "feature">("bug");
  const [feedbackTitle, setFeedbackTitle] = useState("");
  const [feedbackDescription, setFeedbackDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  
  const menuRef = useRef<HTMLDivElement>(null);

  // Close avatar menu on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Fetch display name from clients table (or fallback to email)
  useEffect(() => {
    const fetchName = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Try clients table first (has full_name)
      const { data: clientData } = await supabase
        .from("clients")
        .select("full_name")
        .eq("profile_id", user.id)
        .maybeSingle();

      if (clientData?.full_name) {
        setDisplayName(clientData.full_name);
        return;
      }

      // Fallback to email
      if (user.email) {
        setDisplayName(user.email.split("@")[0]);
      }
    };

    fetchName();
  }, []);

  const initials = displayName
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

  const handleSubmitFeedback = async () => {
    if (!feedbackTitle.trim() || !feedbackDescription.trim()) {
      alert("Please fill in all fields");
      return;
    }

    setSubmitting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("feedback").insert([
      {
        user_id: user?.id || null,
        user_name: displayName || "Anonymous",
        type: feedbackType,
        title: feedbackTitle.trim(),
        description: feedbackDescription.trim(),
        page_url: window.location.href,
      },
    ]);

    if (error) {
      alert("Error submitting feedback. Please try again.");
      setSubmitting(false);
      return;
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
      {/* Sticky banner */}
      <header className="sticky top-0 z-50 bg-ink text-white shadow-md">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
          {/* Logo */}
          <Link
            href={`/${userType}/dashboard`}
            className="flex h-full shrink-0 items-center"
          >
            <div className="flex items-center h-16 w-16">
              <Logo />
            </div>
          </Link>

          {/* Nav — text on desktop, icons on mobile */}
          <nav className="flex flex-1 items-center justify-center gap-1 md:gap-6">
            {navItems.map((item) => {
              const active = isActive(item);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex items-center gap-2 px-2 py-2 text-sm font-medium transition-colors ${
                    active ? "text-gold" : "text-white/70 hover:text-white"
                  }`}
                >
                  <Icon size={20} className="md:hidden" />
                  <span className="hidden md:inline">{item.label}</span>
                  {active && (
                    <span className="absolute -bottom-4.5 left-0 right-0 h-0.5 bg-gold" />
                  )}
                </Link>
              );
            })}
          </nav>

<NotificationBell />

<div ref={menuRef} className="relative shrink-0">
  {/* existing avatar code */}
</div>

          {/* User avatar dropdown */}
          <div ref={menuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="flex items-center gap-3"
            >
              {firstName && (
                <span className="hidden text-sm font-medium md:inline">
                  {firstName}
                </span>
              )}
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-navy text-sm font-semibold text-white ring-2 ring-gold">
                {initials}
              </span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-md bg-surface-raised text-ink shadow-lifted">
                <button
                  type="button"
                  onClick={handleOpenFeedback}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium hover:bg-surface-sunken"
                >
                  <MessageSquare size={16} />
                  Report Bug / Request
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium hover:bg-surface-sunken"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="min-h-[calc(100vh-72px)] bg-surface-base">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
          {children}
        </div>
      </main>

      {/* Feedback Modal */}
      {feedbackModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className={`${styles.card} w-full max-w-lg`}>
            <h2 className={styles.h2}>Report Bug / Request Feature</h2>

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-ink">Type</label>
                <select
                  value={feedbackType}
                  onChange={(e) => setFeedbackType(e.target.value as "bug" | "feature")}
                  className={styles.input}
                >
                  <option value="bug">Bug Report</option>
                  <option value="feature">Feature Request</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-ink">Title</label>
                <input
                  type="text"
                  value={feedbackTitle}
                  onChange={(e) => setFeedbackTitle(e.target.value)}
                  placeholder="Brief summary"
                  className={styles.input}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-ink">Description</label>
                <textarea
                  value={feedbackDescription}
                  onChange={(e) => setFeedbackDescription(e.target.value)}
                  placeholder="Provide details..."
                  rows={6}
                  className={styles.input}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSubmitFeedback}
                  disabled={submitting}
                  className={`${styles.buttonPrimary} flex-1 disabled:opacity-50`}
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
                  className={`${styles.buttonSecondary} flex-1`}
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