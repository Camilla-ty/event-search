"use client";

import { Button } from "@/src/components/common";

import type { FilterState } from "./types";

type FilterPanelProps = {
  filters: FilterState;
  industries: string[];
  onChange: (next: FilterState) => void;
  onReset: () => void;
  className?: string;
};

export function FilterPanel({
  filters,
  industries,
  onChange,
  onReset,
  className,
}: FilterPanelProps) {
  return (
    <aside
      className={[
        "rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Filters</h2>
        <button
          type="button"
          onClick={onReset}
          className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          Clear all
        </button>
      </div>

      <div className="space-y-4">
        <label className="block space-y-2">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Search</span>
          <input
            type="search"
            value={filters.query}
            onChange={(event) => onChange({ ...filters, query: event.target.value })}
            placeholder="Search sponsor..."
            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Industry</span>
          <select
            value={filters.industry}
            onChange={(event) => onChange({ ...filters, industry: event.target.value })}
            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="all">All industries</option>
            {industries.map((industry) => (
              <option key={industry} value={industry}>
                {industry}
              </option>
            ))}
          </select>
        </label>

        <Button variant="secondary" size="sm" className="w-full" onClick={onReset}>
          Reset Filters
        </Button>
      </div>
    </aside>
  );
}
