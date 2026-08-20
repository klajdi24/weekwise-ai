export default function GlobalLoading() {
  return (
    <div className="min-h-screen app-surface p-6 md:p-10">
      <section className="max-w-6xl mx-auto app-layer space-y-5 section-enter">
        <div className="h-36 rounded-3xl bg-white/[0.05] border border-white/10 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-40 rounded-2xl bg-white/[0.04] border border-white/10 animate-pulse" />
          <div className="h-40 rounded-2xl bg-white/[0.04] border border-white/10 animate-pulse" />
          <div className="h-40 rounded-2xl bg-white/[0.04] border border-white/10 animate-pulse" />
        </div>
        <div className="h-56 rounded-2xl bg-white/[0.04] border border-white/10 animate-pulse" />
      </section>
    </div>
  );
}
