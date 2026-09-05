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
        <linearGradient id="wwMark" x1="10" y1="6" x2="54" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A78BFA" />
          <stop offset="55%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#5B21B6" />
        </linearGradient>
      </defs>

      <rect x="2" y="2" width="60" height="60" rx="21" fill="url(#wwMark)" />
      <path
        d="M17 22 L25 43 L32 29 L39 43 L47 22"
        stroke="#FBF8FF"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="47" cy="22" r="4.2" fill="#F0B76A" />
    </svg>
  );
}

export default function Logo({
  className = "",
  markClassName = "h-9 w-9",
  showWordmark = true,
  href = "/",
  tone = "onLight",
}: LogoProps) {
  const textColor = tone === "onLight" ? "text-[var(--ink)]" : "text-white";
  const accent = tone === "onLight" ? "text-[var(--brand)]" : "text-violet-300";

  const inner = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className={markClassName} />
      {showWordmark && (
        <span className={`font-display font-semibold tracking-tight text-[1.05rem] leading-none ${textColor}`}>
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
