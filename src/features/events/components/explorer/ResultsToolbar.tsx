"use client";

type SortValue = "date" | "name";
type ViewValue = "grid";

type ResultsToolbarProps = {
  total: number;
  sort: SortValue;
  view: ViewValue;
  onSortChange: (value: SortValue) => void;
  onOpenFilters: () => void;
};

export function ResultsToolbar({
  total,
  sort,
  view,
  onSortChange,
  onOpenFilters,
}: ResultsToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        <span className="font-semibold text-slate-900 dark:text-slate-100">{total.toLocaleString()}</span>{" "}
        events found
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenFilters}
          className="inline-flex h-9 items-center rounded-lg border border-slate-300 px-3 text-sm font-medium md:hidden dark:border-slate-700"
        >
          Filters
        </button>

        <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          Sort by
          <select
            value={sort}
            onChange={(event) => onSortChange(event.target.value as SortValue)}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="date">Event Date</option>
            <option value="name">Event Name</option>
          </select>
        </label>

        <button
          type="button"
          className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-slate-100 px-3 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          aria-label="Grid view"
        >
          {view}
        </button>
      </div>
    </div>
  );
}
