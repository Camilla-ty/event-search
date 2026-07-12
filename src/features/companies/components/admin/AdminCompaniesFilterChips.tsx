"use client";

import type { CompanyListFilter } from "@/src/features/companies/server/companyAdmin";

const FILTER_OPTIONS: Array<{ value: CompanyListFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "social_website", label: "Hosted platform website" },
  { value: "missing_logo", label: "Missing logo" },
  { value: "needs_logo_review", label: "Needs logo review" },
];

type AdminCompaniesFilterChipsProps = {
  filter: CompanyListFilter;
  onFilterChange: (filter: CompanyListFilter) => void;
};

export function AdminCompaniesFilterChips({
  filter,
  onFilterChange,
}: AdminCompaniesFilterChipsProps) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {FILTER_OPTIONS.map((option) => {
        const active = option.value === filter;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onFilterChange(option.value)}
            className={
              active
                ? "rounded-full bg-brand-primary px-3 py-1.5 text-sm font-medium text-white"
                : "rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function companyListFilterLabel(filter: CompanyListFilter): string {
  return FILTER_OPTIONS.find((option) => option.value === filter)?.label ?? "All";
}
