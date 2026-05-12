export default function EventDetailLoading() {
  return (
    <section className="space-y-6">
      <div className="h-5 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="aspect-[16/9] animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="h-4 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-8 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
            ))}
          </div>
        </div>
      </div>

      <div className="h-40 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="h-72 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
        <div className="h-40 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
      </div>
    </section>
  );
}
