"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getClientAuth } from "@/lib/authClient";
import Logo from "./logo";

const desktopLinks = [
  { href: "/", label: "Today" },
  { href: "/schedule", label: "Schedule" },
  { href: "/momentum", label: "Momentum" },
  { href: "/notes", label: "Notes" },
  { href: "/summarize", label: "Summarize" },
  { href: "/essay", label: "Essay" },
  { href: "/fitness", label: "Fitness" },
];

const dockLinks = [
  { href: "/", label: "Today", icon: HomeIcon },
  { href: "/schedule", label: "Plan", icon: ScheduleIcon },
  { href: "/momentum", label: "Streak", icon: MomentumIcon },
  { href: "/notes", label: "Notes", icon: NotesIcon },
];

const moreLinks = [
  { href: "/summarize", label: "PDF Summarizer", hint: "Lecture slides → study pack" },
  { href: "/essay", label: "Essay Coach", hint: "Outlines and draft feedback" },
  { href: "/fitness", label: "Fitness", hint: "Log workouts and steps" },
  { href: "/pricing", label: "Pricing", hint: "Plans and AI limits" },
  { href: "/profile", label: "Profile", hint: "Account, XP and badges" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [email, setEmail] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    let cancelled = false;

    getClientAuth(supabase).then(({ user }) => {
      if (!cancelled) setEmail(user?.email ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        setEmail(session?.user?.email ?? null);
        return;
      }
      if (event === "SIGNED_OUT") setEmail(null);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);

  const moreActive = moreLinks.some((l) => pathname === l.href || pathname.startsWith(`${l.href}/`));

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <>
      <nav className="sticky top-0 z-40 nav-shell">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Logo tone="onLight" markClassName="h-8 w-8" />

          <div className="hidden lg:flex items-center gap-0.5">
            {desktopLinks.map((link) => {
              const active = pathname === link.href;
              return (
                <Link key={link.href} href={link.href} className={`nav-link ${active ? "active" : ""}`}>
                  {link.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <Link href="/pricing" className="hidden md:inline nav-link">
              Pricing
            </Link>
            {email ? (
              <>
                <Link
                  href="/profile"
                  className="hidden sm:inline text-xs text-[var(--muted)] max-w-[120px] truncate hover:text-[var(--ink)]"
                  title={email}
                >
                  {email.split("@")[0]}
                </Link>
                <button type="button" onClick={signOut} className="btn-secondary text-sm py-2 px-3">
                  Sign out
                </button>
              </>
            ) : (
              <Link href="/login" className="btn-primary text-sm py-2 px-4">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </nav>

      {sheetOpen && (
        <>
          <button type="button" className="sheet-overlay lg:hidden" aria-label="Close menu" onClick={() => setSheetOpen(false)} />
          <div className="nav-sheet lg:hidden" role="dialog" aria-label="More tools">
            <p className="eyebrow mb-3 px-1">More</p>
            <div className="grid gap-1">
              {moreLinks.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`rounded-xl px-3 py-2.5 ${
                      active ? "bg-[var(--brand-tint)] text-[var(--brand-bright)]" : "text-[var(--ink)] hover:bg-white/[0.06]"
                    }`}
                  >
                    <span className="block text-sm font-semibold">{link.label}</span>
                    <span className="block text-xs text-[var(--muted)] mt-0.5">{link.hint}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}

      <nav className="lg:hidden fixed bottom-3 left-3 right-3 z-40 mobile-dock p-1.5" aria-label="Primary">
        <div className="grid grid-cols-5 gap-0.5">
          {dockLinks.map((link) => {
            const active = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href} className={`dock-link ${active ? "active" : ""}`}>
                <Icon />
                <span>{link.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            className={`dock-link ${moreActive || sheetOpen ? "active" : ""}`}
            onClick={() => setSheetOpen((v) => !v)}
            aria-expanded={sheetOpen}
          >
            <MoreIcon />
            <span>More</span>
          </button>
        </div>
      </nav>
    </>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" strokeLinejoin="round" />
    </svg>
  );
}

function ScheduleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  );
}

function MomentumIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 17 10 9l4 5 6-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NotesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M7 3h8l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
      <path d="M15 3v4h4M9 12h6M9 16h4" strokeLinecap="round" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}
