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
  seriesOptions: string[];
  countryOptions: string[];
  onChange: (next: EventFilters) => void;
  onReset: () => void;
  className?: string;
};

export function FilterPanel({
  filters,
  seriesOptions,
  countryOptions,
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
          placeholder="Search event name or domain"
          className={filterInputClass}
        />
      </FilterField>

      <FilterField label="Event series">
        <select
          value={filters.series}
          onChange={(event) => onChange({ ...filters, series: event.target.value })}
          className={filterInputClass}
        >
          <option value="all">All series</option>
          {seriesOptions.map((series) => (
            <option key={series} value={series}>
              {series}
            </option>
          ))}
        </select>
      </FilterField>

      <FilterField label="Country">
        <select
          value={filters.region}
          onChange={(event) => onChange({ ...filters, region: event.target.value })}
          className={filterInputClass}
        >
          <option value="all">All countries</option>
          {countryOptions.map((country) => (
            <option key={country} value={country}>
              {country}
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