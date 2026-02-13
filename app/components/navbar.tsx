"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MascotIcon } from "./mascot";

const links = [
  { href: "/", label: "Home" },
  { href: "/schedule", label: "Schedule" },
  { href: "/fitness", label: "Fitness" },
  { href: "/momentum", label: "Momentum" },
  { href: "/notes", label: "Notes" },
  { href: "/summarize", label: "Summarize" },
  { href: "/profile", label: "Profile" },
  { href: "/pricing", label: "Pricing" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <>
      <nav className="sticky top-0 z-40 border-b border-indigo-100/70 bg-white/88 backdrop-blur supports-[backdrop-filter]:bg-white/75 shadow-[0_6px_20px_rgba(15,23,42,0.06)]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="font-black text-lg text-slate-900 tracking-tight flex items-center gap-2">
            <MascotIcon mood="happy" className="h-8 w-8" />
            <span>
              WeekWise <span className="text-indigo-600">AI</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-2 text-sm">
            {links.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-full border card-hover ${
                    active
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-[0_8px_18px_rgba(79,70,229,0.32)]"
                      : "bg-white text-slate-700 border-slate-200 hover:border-indigo-300"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          <Link href="/login" className="btn-secondary text-sm">
            Login
          </Link>
        </div>
      </nav>

      <nav className="md:hidden fixed bottom-3 left-3 right-3 z-40 card-soft p-2">
        <div className="grid grid-cols-4 gap-1 text-xs">
          {links.slice(0, 4).map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-center py-2 rounded-lg ${active ? "bg-indigo-600 text-white" : "text-slate-700"}`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
