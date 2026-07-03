"use client";

import { Button } from "@/src/components/common";
import {
  FilterField,
  FilterPanelShell,
  filterDateInputClass,
} from "@/src/components/common/explorer";

import type { EventExplorerTopicFacet } from "@/src/features/events/lib/eventExplorerFilterFacets";
import {
  buildCountryCheckboxOptions,
  toggleCountrySelection,
} from "@/src/features/events/lib/filterPanelCountries";
import {
  buildTopicCheckboxOptions,
  toggleTopicSelection,
} from "@/src/features/events/lib/filterPanelTopics";

import type { EventFilters } from "./types";

type FilterPanelProps = {
  filters: EventFilters;
  countryOptions: string[];
  topicOptions: EventExplorerTopicFacet[];
  /** @deprecated Unknown topics are derived from selected slugs not in `topicOptions`. */
  topicUnknown?: boolean;
  onChange: (next: EventFilters) => void;
  onReset: () => void;
  className?: string;
};

export function FilterPanel({
  filters,
  countryOptions,
  topicOptions,
  onChange,
  onReset,
  className,
}: FilterPanelProps) {
  const topicCheckboxOptions = buildTopicCheckboxOptions(topicOptions, filters.topics);
  const selectedTopicCount = filters.topics.length;
  const countryCheckboxOptions = buildCountryCheckboxOptions(
    countryOptions,
    filters.regions,
  );
  const selectedCountryCount = filters.regions.length;

  return (
    <FilterPanelShell onReset={onReset} className={className}>
      <FilterField
        label={
          selectedTopicCount > 0
            ? `Keyword (${selectedTopicCount} selected)`
            : "Keyword"
        }
      >
        <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white">
          {topicCheckboxOptions.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-500">No topics available</p>
          ) : (
            topicCheckboxOptions.map((topic) => {
              const checked = filters.topics.includes(topic.slug);

              return (
                <label
                  key={topic.slug}
                  className="flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-sm transition hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) =>
                      onChange({
                        ...filters,
                        topics: toggleTopicSelection(
                          filters.topics,
                          topic.slug,
                          event.target.checked,
                        ),
                      })
                    }
                    className="size-4 shrink-0 rounded border-slate-300 text-brand-primary focus:ring-2 focus:ring-brand-primary/30"
                  />
                  <span
                    className={[
                      "min-w-0 truncate",
                      checked ? "font-medium text-brand-primary" : "text-slate-700",
                    ].join(" ")}
                    title={topic.name}
                  >
                    {topic.name}
                  </span>
                </label>
              );
            })
          )}
        </div>
      </FilterField>

      <FilterField
        label={
          selectedCountryCount > 0
            ? `Country (${selectedCountryCount} selected)`
            : "Country"
        }
      >
        <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white">
          {countryCheckboxOptions.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-500">No countries available</p>
          ) : (
            countryCheckboxOptions.map((country) => {
              const checked = filters.regions.includes(country.value);

              return (
                <label
                  key={country.value}
                  className="flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-sm transition hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) =>
                      onChange({
                        ...filters,
                        regions: toggleCountrySelection(
                          filters.regions,
                          country.value,
                          event.target.checked,
                        ),
                      })
                    }
                    className="size-4 shrink-0 rounded border-slate-300 text-brand-primary focus:ring-2 focus:ring-brand-primary/30"
                  />
                  <span
                    className={[
                      "min-w-0 truncate",
                      checked ? "font-medium text-brand-primary" : "text-slate-700",
                    ].join(" ")}
                    title={country.label}
                  >
                    {country.label}
                  </span>
                </label>
              );
            })
          )}
        </div>
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