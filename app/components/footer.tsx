import Logo from "./logo";

export default function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/8 bg-[#07121f]/80 backdrop-blur-md mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <Logo tone="dark" markClassName="h-7 w-7" className="opacity-90" />
        <p className="text-xs text-slate-400 text-center sm:text-right">
          © {new Date().getFullYear()} WeekWise AI · Focus · Momentum · Balance
        </p>
      </div>
    </footer>
  );
}
