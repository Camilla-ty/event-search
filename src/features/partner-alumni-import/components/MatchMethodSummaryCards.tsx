import type { MatchMethodSummary } from "../types";

type MatchMethodSummaryCardsProps = {
  summary: MatchMethodSummary;
  resolvedCount: number;
};

const ITEMS: Array<{
  key: keyof MatchMethodSummary;
  label: string;
  className: string;
  emphasis?: boolean;
}> = [
  { key: "domain", label: "Domain matches", className: "bg-sky-50 text-sky-950 border-sky-200" },
  { key: "alias", label: "Alias matches", className: "bg-indigo-50 text-indigo-950 border-indigo-200" },
  {
    key: "website",
    label: "Website matches",
    className: "bg-teal-50 text-teal-950 border-teal-200",
  },
  {
    key: "exact_name",
    label: "Exact-name matches",
    className: "bg-amber-50 text-amber-950 border-amber-200",
  },
  {
    key: "manual",
    label: "Manual matches",
    className: "bg-violet-50 text-violet-950 border-violet-200",
  },
  {
    key: "create_new",
    label: "Create-new rows",
    className: "bg-rose-100 text-rose-950 border-rose-300 ring-2 ring-rose-200",
    emphasis: true,
  },
];

export function MatchMethodSummaryCards({ summary, resolvedCount }: MatchMethodSummaryCardsProps) {
  return (
    <section className="space-y-3" aria-labelledby="match-method-summary-title">
      <div>
        <h3 id="match-method-summary-title" className="text-base font-semibold text-slate-900">
          Resolved row summary
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Breakdown of {resolvedCount} resolved row{resolvedCount === 1 ? "" : "s"} ready to import.
          Create-new rows will add new companies to the catalog.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {ITEMS.map((item) => {
          const count = summary[item.key];
          return (
            <div
              key={item.key}
              className={[
                "rounded-xl border px-4 py-3",
                item.className,
                item.emphasis && count > 0 ? "shadow-sm" : "",
              ].join(" ")}
            >
              <p className={item.emphasis ? "text-xs font-bold uppercase tracking-wide" : "text-xs font-medium uppercase tracking-wide opacity-80"}>
                {item.label}
              </p>
              <p
                className={[
                  "mt-1 tabular-nums",
                  item.emphasis ? "text-3xl font-bold" : "text-2xl font-semibold",
                ].join(" ")}
              >
                {count}
              </p>
            </div>
          );
        })}
      </div>
      {summary.create_new > 0 ? (
        <div
          role="alert"
          className="rounded-xl border-2 border-rose-400 bg-rose-50 px-5 py-4 text-rose-950"
        >
          <p className="text-lg font-bold">
            {summary.create_new} new compan{summary.create_new === 1 ? "y" : "ies"} will be created
          </p>
          <p className="mt-1 text-sm">
            You must explicitly acknowledge this count before import can proceed. Unmatched rows are
            never imported automatically.
          </p>
        </div>
      ) : null}
    </section>
  );
}
