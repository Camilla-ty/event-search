"use client";

import { Button } from "@/src/components/common";
import {
  FilterField,
  FilterPanelShell,
  filterDateInputClass,
  filterInputClass,
} from "@/src/components/common/explorer";

import type { EventFilters } from "./types";

type FilterPanelProps = {
  filters: EventFilters;
  industries: string[];
  regions: string[];
  types: string[];
  onChange: (next: EventFilters) => void;
  onReset: () => void;
  className?: string;
};

export function FilterPanel({
  filters,
  industries,
  regions,
  types,
  onChange,
  onReset,
  className,
}: FilterPanelProps) {
  return (
    <FilterPanelShell onReset={onReset} className={className}>
      <FilterField label="Search">
        <input
          type="search"
          value={filters.query}
          onChange={(event) => onChange({ ...filters, query: event.target.value })}
          placeholder="Search event..."
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

      <FilterField label="Region">
        <select
          value={filters.region}
          onChange={(event) => onChange({ ...filters, region: event.target.value })}
          className={filterInputClass}
        >
          <option value="all">All regions</option>
          {regions.map((region) => (
            <option key={region} value={region}>
              {region}
            </option>
          ))}
        </select>
      </FilterField>

      <FilterField label="Type">
        <select
          value={filters.type}
          onChange={(event) => onChange({ ...filters, type: event.target.value })}
          className={filterInputClass}
        >
          <option value="all">All types</option>
          {types.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </FilterField>

      <div className="grid grid-cols-2 gap-2">
        <FilterField label="Start date">
          <input
            type="date"
            value={filters.startDate}
            onChange={(event) => onChange({ ...filters, startDate: event.target.value })}
            className={filterDateInputClass}
          />
        </FilterField>

        <FilterField label="End date">
          <input
            type="date"
            value={filters.endDate}
            onChange={(event) => onChange({ ...filters, endDate: event.target.value })}
            className={filterDateInputClass}
          />
        </FilterField>
      </div>

      <Button variant="secondary" size="sm" className="w-full" onClick={onReset}>
        Reset Filters
      </Button>
    </FilterPanelShell>
  );
}