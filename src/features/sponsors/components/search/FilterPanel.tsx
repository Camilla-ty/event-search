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
  eventName?: string | null;
  eventUnknown?: boolean;
  onChange: (next: FilterState) => void;
  onReset: () => void;
  className?: string;
};

export function FilterPanel({
  filters,
  eventName = null,
  eventUnknown = false,
  onChange,
  onReset,
  className,
}: FilterPanelProps) {
  const eventSlug = filters.eventSlug?.trim() ?? "";
  const eventScopeLabel =
    eventSlug !== ""
      ? eventUnknown
        ? eventSlug
        : eventName?.trim()
          ? eventName.trim()
          : eventSlug
      : null;

  return (
    <FilterPanelShell onReset={onReset} className={className}>
      {eventScopeLabel ? (
        <FilterField label="Event">
          <p
            className={[
              "rounded-lg border px-3 py-2 text-sm font-medium",
              eventUnknown
                ? "border-amber-200 bg-amber-50 text-amber-950"
                : "border-brand-primary/20 bg-brand-primary-muted text-slate-900",
            ].join(" ")}
          >
            {eventScopeLabel}
          </p>
        </FilterField>
      ) : null}

      <FilterField label="Search">
        <input
          type="search"
          value={filters.query}
          onChange={(event) => onChange({ ...filters, query: event.target.value })}
          placeholder="Search sponsors and companies..."
          className={filterInputClass}
        />
      </FilterField>

      <Button variant="secondary" size="sm" className="w-full" onClick={onReset}>
        Reset Filters
      </Button>
    </FilterPanelShell>
  );
}
