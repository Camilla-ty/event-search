type PageLoadingVariant = "list" | "detail" | "form" | "explorer";

export function PageLoadingSkeleton({ variant = "list" }: { variant?: PageLoadingVariant }) {
  if (variant === "detail") {
    return (
      <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading content">
        <div className="h-5 w-40 rounded bg-slate-200" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
          <div className="aspect-[16/9] rounded-xl bg-slate-200" />
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
            <div className="h-4 w-24 rounded bg-slate-200" />
            <div className="h-8 w-2/3 rounded bg-slate-200" />
            <div className="h-4 w-1/2 rounded bg-slate-200" />
          </div>
        </div>
        <div className="h-40 rounded-xl bg-slate-200" />
      </div>
    );
  }

  if (variant === "form") {
    return (
      <div
        className="animate-pulse space-y-4 rounded-xl border border-slate-200 bg-white p-6"
        aria-busy="true"
        aria-label="Loading form"
      >
        <div className="h-6 w-48 rounded bg-slate-200" />
        <div className="h-4 w-72 rounded bg-slate-200" />
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <div className="h-4 w-24 rounded bg-slate-200" />
            <div className="h-10 rounded bg-slate-200" />
          </div>
        ))}
        <div className="h-10 rounded bg-slate-200" />
      </div>
    );
  }

  if (variant === "explorer") {
    return (
      <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading explorer">
        <div className="space-y-2 border-b border-slate-200 pb-6">
          <div className="h-8 w-56 rounded bg-slate-200" />
          <div className="h-4 w-full max-w-xl rounded bg-slate-200" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="hidden h-72 rounded-xl border border-slate-200 bg-white md:block" />
          <div className="space-y-3">
            <div className="h-14 rounded-xl border border-slate-200 bg-white" />
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-28 rounded-xl border border-slate-200 bg-slate-100" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-pulse space-y-3" aria-busy="true" aria-label="Loading list">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="h-28 rounded-xl border border-slate-200 bg-slate-100" />
      ))}
    </div>
  );
}
