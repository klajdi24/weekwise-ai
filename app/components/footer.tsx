import Logo from "./logo";

export default function Footer() {
  return (
    <footer className="relative z-10 border-t border-[var(--line)] bg-transparent backdrop-blur-sm mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <Logo tone="onLight" markClassName="h-7 w-7" />
        <p className="text-xs text-[var(--muted)] text-center sm:text-right">
          © {new Date().getFullYear()} WeekWise AI · Focus · Momentum · Balance
        </p>
      </div>
    </footer>
  );
}
