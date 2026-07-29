"use client";

import { buildActiveCountryChips } from "@/src/features/events/lib/activeCountryChips";
import { buildActiveTopicChips } from "@/src/features/events/lib/activeTopicChips";
import type { EventExplorerTopicFacet } from "@/src/features/events/lib/eventExplorerFilterFacets";
import { formatActiveFilterDateChip } from "@/src/features/events/lib/formatActiveFilterMonthYear";
import { brandLinkClass } from "@/src/lib/design/classes";

type EventExplorerActiveFiltersProps = {
  query: string;
  topics: readonly string[];
  topicOptions: readonly EventExplorerTopicFacet[];
  regions: readonly string[];
  countryOptions: readonly string[];
  startDate: string;
  endDate: string;
  onRemoveSearch: () => void;
  onRemoveKeywords: () => void;
  onRemoveCountries: () => void;
  onRemoveDates: () => void;
  onClearAll: () => void;
};

const chipClassName =
  "inline-flex max-w-full items-center gap-1 rounded-lg border border-brand-primary/25 bg-white px-2.5 py-1 text-sm text-slate-800 shadow-sm";

function ActiveFilterGroupChip({
  label,
  value,
  onRemove,
  removeAriaLabel,
}: {
  label: string;
  value: string;
  onRemove: () => void;
  removeAriaLabel: string;
}) {
  return (
    <span className={chipClassName}>
      <span className="truncate font-medium text-slate-900">
        {label}: {value}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded px-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        aria-label={removeAriaLabel}
      >
        ×
      </button>
    </span>
  );
}

export function EventExplorerActiveFilters({
  query,
  topics,
  topicOptions,
  regions,
  countryOptions,
  startDate,
  endDate,
  onRemoveSearch,
  onRemoveKeywords,
  onRemoveCountries,
  onRemoveDates,
  onClearAll,
}: EventExplorerActiveFiltersProps) {
  const trimmedQuery = query.trim();
  const topicChips = buildActiveTopicChips(topics, topicOptions);
  const countryChips = buildActiveCountryChips(regions, countryOptions);
  const dateChip = formatActiveFilterDateChip(startDate, endDate);

  if (
    trimmedQuery === "" &&
    topicChips.length === 0 &&
    countryChips.length === 0 &&
    dateChip === null
  ) {
    return null;
  }

  return (
    <div className="rounded-xl border border-brand-primary/20 bg-brand-primary-muted px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-900">Active Filters</p>
        <button type="button" onClick={onClearAll} className={brandLinkClass}>
          Clear all
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {trimmedQuery !== "" ? (
          <ActiveFilterGroupChip
            label="Search"
            value={trimmedQuery}
            onRemove={onRemoveSearch}
            removeAriaLabel={`Remove search ${trimmedQuery}`}
          />
        ) : null}
        {topicChips.length > 0 ? (
          <ActiveFilterGroupChip
            label="Keyword"
            value={topicChips.map((chip) => chip.label).join(", ")}
            onRemove={onRemoveKeywords}
            removeAriaLabel="Remove keyword filters"
          />
        ) : null}
        {countryChips.length > 0 ? (
          <ActiveFilterGroupChip
            label="Country"
            value={countryChips.map((chip) => chip.label).join(", ")}
            onRemove={onRemoveCountries}
            removeAriaLabel="Remove country filters"
          />
        ) : null}
        {dateChip !== null ? (
          <ActiveFilterGroupChip
            label={dateChip.label}
            value={dateChip.value}
            onRemove={onRemoveDates}
            removeAriaLabel={`Remove date filter ${dateChip.value}`}
          />
        ) : null}
      </div>
    </div>
  );
}
