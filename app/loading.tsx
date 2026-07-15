export default function GlobalLoading() {
  return (
    <div className="min-h-screen app-surface p-6 md:p-10">
      <section className="max-w-6xl mx-auto app-layer space-y-5 section-enter">
        <div className="h-36 rounded-3xl bg-white/70 border border-white/40 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-40 rounded-2xl bg-white/75 border border-white/40 animate-pulse" />
          <div className="h-40 rounded-2xl bg-white/75 border border-white/40 animate-pulse" />
          <div className="h-40 rounded-2xl bg-white/75 border border-white/40 animate-pulse" />
        </div>
        <div className="h-56 rounded-2xl bg-white/75 border border-white/40 animate-pulse" />
      </section>
    </div>
  );
}
