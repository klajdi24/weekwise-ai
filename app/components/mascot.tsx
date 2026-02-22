interface MascotProps {
  mood?: "happy" | "focus" | "celebrate";
  message?: string;
  className?: string;
  compact?: boolean;
}

export function MascotIcon({ mood = "happy", className = "" }: { mood?: "happy" | "focus" | "celebrate"; className?: string }) {
  const eyes = mood === "focus" ? "M26 30h6 M40 30h6" : "M27 29.5a2 2 0 1 0 0 .01 M41 29.5a2 2 0 1 0 0 .01";
  const mouth =
    mood === "celebrate"
      ? "M26 41c4.6 5 14.4 5 19 0"
      : mood === "focus"
      ? "M29 41h14"
      : "M28 40c3.6 3.4 10.4 3.4 14 0";

  return (
    <div className={`relative ${className}`} aria-hidden="true">
      {mood === "celebrate" && (
        <>
          <span className="absolute -top-1 -left-1 h-2.5 w-2.5 rounded-full bg-fuchsia-400 mascot-pop" />
          <span className="absolute -top-2 right-1 h-2 w-2 rounded-full bg-amber-300 mascot-pop-delayed" />
        </>
      )}

      <svg viewBox="0 0 72 72" className="h-full w-full mascot-float" role="img" aria-label="WeekWise mascot">
        <defs>
          <linearGradient id="mascotBody" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
        </defs>

        <circle cx="36" cy="36" r="30" fill="url(#mascotBody)" />
        <ellipse cx="36" cy="38" rx="18" ry="17" fill="#EEF2FF" />
        <path d="M17 24c7-9 31-9 38 0" stroke="#A5B4FC" strokeWidth="3" strokeLinecap="round" fill="none" />

        <path d={eyes} stroke="#1E1B4B" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d={mouth} stroke="#1E1B4B" strokeWidth="3" strokeLinecap="round" fill="none" />

        <circle cx="24" cy="36" r="2.5" fill="#C4B5FD" opacity=".8" />
        <circle cx="48" cy="36" r="2.5" fill="#C4B5FD" opacity=".8" />
      </svg>
    </div>
  );
}

export default function Mascot({ mood = "happy", message, className = "", compact = false }: MascotProps) {
  const bubble =
    message ??
    (mood === "celebrate"
      ? "Great progress. Keep the streak alive."
      : mood === "focus"
      ? "One focused session now saves stress later."
      : "You’ve got this — small steps, every day.");

  return (
    <div className={`card-soft p-4 flex items-center gap-3 ${className}`}>
      <MascotIcon mood={mood} className={`${compact ? "h-12 w-12" : "h-14 w-14"}`} />
      <div>
        <p className="text-sm text-slate-500">Captain WeekWise</p>
        <p className="font-semibold text-slate-800">{bubble}</p>
      </div>
    </div>
  );
}
