"use client";

import { useState } from "react";

import {
  ExplorerResultsToolbar,
  MobileFilterDrawer,
  PageHeader,
} from "@/src/components/common/explorer";
import { Button } from "@/src/components/common";
import { useEventExplorerCollection } from "@/src/features/events/client/useEventExplorerCollection";
import { useEventExplorerFilterBridgePublisher } from "@/src/features/events/client/EventExplorerFilterBridge";
import { toggleCountrySelection } from "@/src/features/events/lib/filterPanelCountries";
import { toggleTopicSelection } from "@/src/features/events/lib/filterPanelTopics";
import type { EventExplorerSortMode } from "@/src/features/events/lib/eventExplorerOrdering";
import {
  explorerFilterStickyClass,
  explorerPageGridClass,
} from "@/src/lib/layout/explorerLayout";
import { feedbackWarningClass } from "@/src/lib/design/classes";
import type { EventExplorerPageResult } from "@/src/features/events/server/eventExplorerTypes";

import { ActiveTopicFilters } from "./ActiveTopicFilters";
import { EventGrid } from "./EventGrid";
import { FilterPanel } from "./FilterPanel";

const EVENT_SORT_OPTIONS: { value: EventExplorerSortMode; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "reviewed", label: "Recently Reviewed" },
  { value: "date_asc", label: "Event Date (Oldest First)" },
  { value: "date_desc", label: "Event Date (Newest First)" },
  { value: "name", label: "Event Name" },
];

type EventExplorerPageProps = {
  initial: EventExplorerPageResult;
};

export function EventExplorerPage({ initial }: EventExplorerPageProps) {
  const {
    rows,
    total,
    facets,
    params,
    isLoading,
    error,
    setFilters,
    setSort,
    setPage,
    resetAll,
    retry,
  } = useEventExplorerCollection(initial);
  useEventExplorerFilterBridgePublisher(params.filters, setFilters);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  function handleReset() {
    resetAll();
  }

  function handleClearAllFilters() {
    setFilters({
      ...params.filters,
      topics: [],
      regions: [],
    });
  }

  function handleRemoveTopic(slug: string) {
    setFilters({
      ...params.filters,
      topics: toggleTopicSelection(params.filters.topics, slug, false),
    });
  }

  function handleRemoveCountry(country: string) {
    setFilters({
      ...params.filters,
      regions: toggleCountrySelection(params.filters.regions, country, false),
    });
  }

  return (
    <section className="space-y-4">
      <PageHeader
        title="Events"
        description="Discover events, analyze sponsor activity, and find new opportunities."
      />

      <div className={explorerPageGridClass}>
        <div className="hidden md:block">
          <FilterPanel
            filters={params.filters}
            countryOptions={facets.countries}
            topicOptions={facets.topics}
            onChange={setFilters}
            onReset={handleReset}
            className={explorerFilterStickyClass}
          />
        </div>

        <div className="space-y-4">
          <ActiveTopicFilters
            topics={params.filters.topics}
            topicOptions={facets.topics}
            regions={params.filters.regions}
            countryOptions={facets.countries}
            onRemoveTopic={handleRemoveTopic}
            onRemoveCountry={handleRemoveCountry}
            onClearAll={handleClearAllFilters}
          />
          <ExplorerResultsToolbar
            total={total}
            entityLabel="events"
            sort={params.sort}
            sortOptions={EVENT_SORT_OPTIONS}
            onSortChange={setSort}
            onOpenFilters={() => setMobileFiltersOpen(true)}
          />
          {error !== null ? (
            <div
              role="alert"
              className={`flex flex-wrap items-center justify-between gap-3 ${feedbackWarningClass}`}
            >
              <span>
                We couldn&apos;t load the latest results. Still showing the previous
                results.
              </span>
              <Button variant="ghost" size="sm" onClick={retry}>
                Retry
              </Button>
            </div>
          ) : null}
          <EventGrid
            rows={rows}
            total={total}
            page={params.page}
            pageSize={initial.page_size}
            loading={isLoading}
            onPageChange={setPage}
            onReset={handleReset}
          />
        </div>
      </div>

      <MobileFilterDrawer
        open={mobileFiltersOpen}
        onClose={() => setMobileFiltersOpen(false)}
      >
        <FilterPanel
          filters={params.filters}
          countryOptions={facets.countries}
          topicOptions={facets.topics}
          onChange={setFilters}
          onReset={handleReset}
        />
      </MobileFilterDrawer>
    </section>
  );
}
