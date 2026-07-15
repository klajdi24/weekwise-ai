import Link from "next/link";

interface LogoProps {
  className?: string;
  markClassName?: string;
  showWordmark?: boolean;
  href?: string | null;
  tone?: "light" | "dark" | "onLight";
}

export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="WeekWise AI logo">
      <defs>
        <linearGradient id="wwMark" x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2DD4BF" />
          <stop offset="55%" stopColor="#14B8A6" />
          <stop offset="100%" stopColor="#0F766E" />
        </linearGradient>
        <linearGradient id="wwArc" x1="10" y1="18" x2="54" y2="18" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5EEAD4" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>
      </defs>

      <rect x="2" y="2" width="60" height="60" rx="18" fill="url(#wwMark)" />
      <path
        d="M14 22c6.5-8 29.5-8 36 0"
        stroke="url(#wwArc)"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.95"
      />
      <path
        d="M18 44 L26 24 L32 36 L38 24 L46 44"
        stroke="#F0FDFA"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="48" cy="18" r="3.2" fill="#FACC15" />
    </svg>
  );
}

export default function Logo({
  className = "",
  markClassName = "h-9 w-9",
  showWordmark = true,
  href = "/",
  tone = "dark",
}: LogoProps) {
  const textColor = tone === "onLight" ? "text-slate-900" : tone === "light" ? "text-white" : "text-slate-50";
  const accent = tone === "onLight" ? "text-teal-700" : tone === "light" ? "text-teal-200" : "text-teal-300";

  const inner = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className={markClassName} />
      {showWordmark && (
        <span className={`font-display font-bold tracking-tight text-lg leading-none ${textColor}`}>
          WeekWise <span className={accent}>AI</span>
        </span>
      )}
    </span>
  );

  if (href === null) return inner;
  return (
    <Link href={href} className="shrink-0" aria-label="WeekWise AI home">
      {inner}
    </Link>
  );
}
