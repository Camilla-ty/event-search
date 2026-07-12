"use client";

import type { EditionsListFilter } from "@/src/features/events/server/editionsListParams";
import { deriveEditionsListFilter } from "@/src/features/events/client/editionsListCollectionState";
import type { EditionsListParams } from "@/src/features/events/server/editionsListParams";

const FILTER_OPTIONS: Array<{ value: EditionsListFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "missingWebsite", label: "Missing website" },
  { value: "missingDates", label: "Missing dates" },
  { value: "missingCity", label: "Missing city" },
];

type AdminEventEditionsFilterChipsProps = {
  params: EditionsListParams;
  onFilterChange: (filter: EditionsListFilter) => void;
};

export function AdminEventEditionsFilterChips({
  params,
  onFilterChange,
}: AdminEventEditionsFilterChipsProps) {
  const activeFilter = deriveEditionsListFilter(params);

  return (
    <div className="mb-4 flex flex-wrap gap-2 text-sm">
      {FILTER_OPTIONS.map((option) => {
        const active = option.value === activeFilter;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onFilterChange(option.value)}
            className={
              active
                ? "rounded-md border border-slate-400 bg-slate-50 px-3 py-1 font-medium text-slate-900"
                : "rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-50"
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
