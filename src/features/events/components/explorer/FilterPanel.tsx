"use client";

import { Button } from "@/src/components/common";
import {
  FilterField,
  FilterPanelShell,
  filterDateInputClass,
  filterInputClass,
} from "@/src/components/common/explorer";

import type { EventExplorerTopicFacet } from "@/src/features/events/lib/eventExplorerFilterFacets";

import type { EventFilters } from "./types";

type FilterPanelProps = {
  filters: EventFilters;
  seriesOptions: string[];
  countryOptions: string[];
  topicOptions: EventExplorerTopicFacet[];
  topicUnknown?: boolean;
  onChange: (next: EventFilters) => void;
  onReset: () => void;
  className?: string;
};

export function FilterPanel({
  filters,
  seriesOptions,
  countryOptions,
  topicOptions,
  topicUnknown = false,
  onChange,
  onReset,
  className,
}: FilterPanelProps) {
  const activeTopicSlug = filters.topic.trim();
  const topicOptionsWithActive =
    activeTopicSlug !== "" &&
    topicUnknown &&
    !topicOptions.some((topic) => topic.slug === activeTopicSlug)
      ? [{ slug: activeTopicSlug, name: `${activeTopicSlug} (not found)` }, ...topicOptions]
      : topicOptions;

  return (
    <FilterPanelShell onReset={onReset} className={className}>
      <FilterField label="Topic">
        <select
          value={activeTopicSlug}
          onChange={(event) => onChange({ ...filters, topic: event.target.value })}
          className={filterInputClass}
        >
          <option value="">All topics</option>
          {topicOptionsWithActive.map((topic) => (
            <option key={topic.slug} value={topic.slug}>
              {topic.name}
            </option>
          ))}
        </select>
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