export default function NewEventEditionLoading() {
  return (
    <main className="mx-auto w-full max-w-xl p-6">
      <div className="animate-pulse space-y-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="h-6 w-48 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-4 w-72 rounded bg-slate-200 dark:bg-slate-800" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-10 rounded bg-slate-200 dark:bg-slate-800" />
          </div>
        ))}
        <div className="h-10 rounded bg-slate-200 dark:bg-slate-800" />
      </div>
    </main>
  );
}
