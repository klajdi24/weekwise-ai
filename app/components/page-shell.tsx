import type { ReactNode } from "react";

interface PageShellProps {
  children: ReactNode;
  className?: string;
  narrow?: boolean;
}

/** Consistent page canvas — use a div (layout already provides main). */
export default function PageShell({ children, className = "", narrow = false }: PageShellProps) {
  return (
    <div className={`app-surface min-h-full p-5 md:p-8 lg:p-10 ${className}`}>
      <div className={`${narrow ? "max-w-3xl" : "max-w-6xl"} mx-auto app-layer space-y-6`}>{children}</div>
    </div>
  );
}

interface PageHeroProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
}

export function PageHero({ eyebrow = "WeekWise AI", title, subtitle, actions, meta, children }: PageHeroProps) {
  return (
    <header className="hero-panel p-6 md:p-8">
      <p className="eyebrow text-teal-300/90">{eyebrow}</p>
      <div className="mt-3 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <h1 className="page-title text-white">{title}</h1>
          {subtitle && <p className="mt-3 text-teal-50/75 text-[0.95rem] md:text-base max-w-xl">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
      </div>
      {meta && <div className="mt-5 flex flex-wrap gap-2">{meta}</div>}
      {children}
    </header>
  );
}
