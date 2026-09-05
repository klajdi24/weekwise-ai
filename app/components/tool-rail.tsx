import Link from "next/link";

const GROUPS = [
  {
    label: "Plan",
    items: [
      { href: "/schedule", title: "Schedule", text: "Classes, deadlines, AI week plan" },
      { href: "/momentum", title: "Momentum", text: "XP, streak and today’s checklist" },
      { href: "/fitness", title: "Fitness", text: "Workouts that protect your streak" },
    ],
  },
  {
    label: "Study",
    items: [
      { href: "/notes", title: "Notes", text: "Summaries, terms and quiz packs" },
      { href: "/summarize", title: "Summarize", text: "Turn lecture PDFs into study packs" },
      { href: "/essay", title: "Essay", text: "Outlines, drafts and structure checks" },
    ],
  },
];

export default function ToolRail() {
  return (
    <div className="space-y-5">
      {GROUPS.map((group) => (
        <section key={group.label}>
          <p className="eyebrow text-[var(--muted)] mb-2">{group.label}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {group.items.map((item) => (
              <Link key={item.href} href={item.href} className="tool-chip card-hover">
                <span className="feature-icon shrink-0 h-10 w-10">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span>
                  <span className="block font-display font-semibold text-[var(--ink)]">{item.title}</span>
                  <span className="block text-xs text-[var(--muted)] mt-0.5">{item.text}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
