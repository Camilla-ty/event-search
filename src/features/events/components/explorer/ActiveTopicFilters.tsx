"use client";

import Link from "next/link";

import { buildActiveCountryChips } from "@/src/features/events/lib/activeCountryChips";
import { buildActiveTopicChips } from "@/src/features/events/lib/activeTopicChips";
import type { EventExplorerTopicFacet } from "@/src/features/events/lib/eventExplorerFilterFacets";
import { brandLinkClass } from "@/src/lib/design/classes";

type ActiveTopicFiltersProps = {
  topics: readonly string[];
  topicOptions: readonly EventExplorerTopicFacet[];
  regions: readonly string[];
  countryOptions: readonly string[];
  onRemoveTopic: (slug: string) => void;
  onRemoveCountry: (country: string) => void;
  onClearAll: () => void;
};

export function ActiveTopicFilters({
  topics,
  topicOptions,
  regions,
  countryOptions,
  onRemoveTopic,
  onRemoveCountry,
  onClearAll,
}: ActiveTopicFiltersProps) {
  const topicChips = buildActiveTopicChips(topics, topicOptions);
  const countryChips = buildActiveCountryChips(regions, countryOptions);

  if (topicChips.length === 0 && countryChips.length === 0) return null;

  return (
    <div className="rounded-xl border border-brand-primary/20 bg-brand-primary-muted px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-900">Active Filters</p>
        <button type="button" onClick={onClearAll} className={brandLinkClass}>
          Clear all
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {topicChips.map((chip) => (
          <span
            key={`topic-${chip.slug}`}
            className="inline-flex max-w-full items-center gap-1 rounded-lg border border-brand-primary/25 bg-white px-2.5 py-1 text-sm text-slate-800 shadow-sm"
          >
            {chip.hubPath ? (
              <Link href={chip.hubPath} className={`${brandLinkClass} truncate`}>
                {chip.label}
              </Link>
            ) : (
              <span className="truncate font-medium text-slate-900">{chip.label}</span>
            )}
            <button
              type="button"
              onClick={() => onRemoveTopic(chip.slug)}
              className="shrink-0 rounded px-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              aria-label={`Remove ${chip.label}`}
            >
              ×
            </button>
          </span>
        ))}
        {countryChips.map((chip) => (
          <span
            key={`country-${chip.value}`}
            className="inline-flex max-w-full items-center gap-1 rounded-lg border border-brand-primary/25 bg-white px-2.5 py-1 text-sm text-slate-800 shadow-sm"
          >
            <span className="truncate font-medium text-slate-900">{chip.label}</span>
            <button
              type="button"
              onClick={() => onRemoveCountry(chip.value)}
              className="shrink-0 rounded px-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              aria-label={`Remove ${chip.label}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
