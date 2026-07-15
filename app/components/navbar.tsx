"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getClientAuth } from "@/lib/authClient";
import Logo from "./logo";

const primaryLinks = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/schedule", label: "Schedule", icon: ScheduleIcon },
  { href: "/momentum", label: "Momentum", icon: MomentumIcon },
  { href: "/fitness", label: "Fitness", icon: FitnessIcon },
  { href: "/notes", label: "Notes", icon: NotesIcon },
];

const moreLinks = [
  { href: "/summarize", label: "Summarize" },
  { href: "/essay", label: "Essay" },
  { href: "/pricing", label: "Pricing" },
  { href: "/profile", label: "Profile" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [email, setEmail] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    getClientAuth(supabase).then(({ user }) => {
      setEmail(user?.email ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const isMoreActive = moreLinks.some((l) => pathname === l.href || pathname.startsWith(l.href + "/"));

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <>
      <nav className="sticky top-0 z-40 nav-shell">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Logo tone="dark" markClassName="h-8 w-8" />

          <div className="hidden lg:flex items-center gap-1">
            {primaryLinks.map((link) => {
              const active = pathname === link.href;
              return (
                <Link key={link.href} href={link.href} className={`nav-link ${active ? "active" : ""}`}>
                  {link.label}
                </Link>
              );
            })}

            <div className="relative">
              <button
                type="button"
                className={`nav-link ${isMoreActive ? "active" : ""}`}
                onClick={() => setMoreOpen((v) => !v)}
                aria-expanded={moreOpen}
                aria-haspopup="menu"
              >
                More
              </button>
              {moreOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-44 rounded-2xl border border-white/10 bg-[#0c1a2b]/95 backdrop-blur-xl shadow-2xl p-1.5 z-50"
                >
                  {moreLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      role="menuitem"
                      className={`block px-3 py-2 rounded-xl text-sm font-semibold ${
                        pathname === link.href || pathname.startsWith(link.href + "/")
                          ? "bg-teal-400/20 text-teal-200"
                          : "text-slate-200 hover:bg-white/8"
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {email ? (
              <>
                <Link
                  href="/profile"
                  className="hidden sm:inline text-xs text-teal-100/70 max-w-[140px] truncate hover:text-teal-100"
                  title={email}
                >
                  {email.split("@")[0]}
                </Link>
                <button type="button" onClick={signOut} className="btn-dark text-sm py-2 px-3">
                  Sign out
                </button>
              </>
            ) : (
              <Link href="/login" className="btn-primary text-sm py-2 px-4 shadow-none">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </nav>

      <nav className="lg:hidden fixed bottom-3 left-3 right-3 z-40 mobile-dock p-1.5" aria-label="Primary">
        <div className="grid grid-cols-5 gap-0.5">
          {primaryLinks.map((link) => {
            const active = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href} className={`dock-link ${active ? "active" : ""}`}>
                <Icon />
                <span>{link.label}</span>
              </Link>
            );
          })}
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

function FitnessIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 9v6M18 9v6M9 7v10M15 7v10M6 12H3M21 12h-3M9 12h6" strokeLinecap="round" />
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
