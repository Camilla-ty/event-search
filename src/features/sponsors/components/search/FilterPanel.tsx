"use client";

import { Button } from "@/src/components/common";
import {
  FilterField,
  FilterPanelShell,
  filterInputClass,
} from "@/src/components/common/explorer";

import type { FilterState } from "./types";

type FilterPanelProps = {
  filters: FilterState;
  industries: string[];
  eventName?: string | null;
  onChange: (next: FilterState) => void;
  onReset: () => void;
  className?: string;
};

export function FilterPanel({
  filters,
  industries,
  eventName = null,
  onChange,
  onReset,
  className,
}: FilterPanelProps) {
  const eventSlug = filters.eventSlug?.trim() ?? "";
  const eventScopeLabel =
    eventSlug !== ""
      ? eventName?.trim()
        ? eventName.trim()
        : eventSlug
      : null;

  return (
    <FilterPanelShell onReset={onReset} className={className}>
      {eventScopeLabel ? (
        <FilterField label="Event">
          <p className="rounded-lg border border-brand-primary/20 bg-brand-primary-muted px-3 py-2 text-sm font-medium text-slate-900">
            {eventScopeLabel}
          </p>
        </FilterField>
      ) : null}

      <FilterField label="Search">
        <input
          type="search"
          value={filters.query}
          onChange={(event) => onChange({ ...filters, query: event.target.value })}
          placeholder="Search sponsor..."
          className={filterInputClass}
        />
      </FilterField>

      <FilterField label="Industry">
        <select
          value={filters.industry}
          onChange={(event) => onChange({ ...filters, industry: event.target.value })}
          className={filterInputClass}
        >
          <option value="all">All industries</option>
          {industries.map((industry) => (
            <option key={industry} value={industry}>
              {industry}
            </option>
          ))}
        </select>
      </FilterField>

      <Button variant="secondary" size="sm" className="w-full" onClick={onReset}>
        Reset Filters
      </Button>
    </FilterPanelShell>
  );
}
