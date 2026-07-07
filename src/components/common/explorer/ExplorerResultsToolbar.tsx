"use client";

export type ExplorerSortOption<T extends string> = {
  value: T;
  label: string;
};

type ExplorerResultsToolbarProps<T extends string> = {
  total: number;
  entityLabel: string;
  sort: T;
  sortOptions: ExplorerSortOption<T>[];
  onSortChange: (value: T) => void;
  onOpenFilters?: () => void;
  showSort?: boolean;
};

export function ExplorerResultsToolbar<T extends string>({
  total,
  entityLabel,
  sort,
  sortOptions,
  onSortChange,
  onOpenFilters,
  showSort = true,
}: ExplorerResultsToolbarProps<T>) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-sm text-slate-600">
        <span className="font-semibold text-slate-900">{total.toLocaleString()}</span>{" "}
        {entityLabel} found
      </p>

      <div className="flex items-center gap-2">
        {onOpenFilters ? (
          <button
            type="button"
            onClick={onOpenFilters}
            className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 md:hidden"
          >
            Filters
          </button>
        ) : null}

        {showSort ? (
          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
            Sort by
            <select
              value={sort}
              onChange={(event) => onSortChange(event.target.value as T)}
              className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    </div>
  );
}
