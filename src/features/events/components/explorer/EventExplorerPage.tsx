"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import {
  ExplorerResultsToolbar,
  MobileFilterDrawer,
  PageHeader,
} from "@/src/components/common/explorer";
import type { EventExplorerFilterFacets } from "@/src/features/events/lib/eventExplorerFilterFacets";
import {
  buildEventExplorerClientFilterFacets,
  buildEventExplorerDisplayEvents,
} from "@/src/features/events/lib/eventExplorerClient";
import { toggleCountrySelection } from "@/src/features/events/lib/filterPanelCountries";
import { toggleTopicSelection } from "@/src/features/events/lib/filterPanelTopics";
import {
  buildEventExplorerFilterKey,
  buildEventExplorerSearchParams,
  DEFAULT_EVENT_EXPLORER_FILTERS,
  parseEventExplorerFiltersFromSearchParams,
} from "@/src/features/events/lib/eventExplorerQuery";
import {
  DEFAULT_EVENT_EXPLORER_SORT_MODE,
  type EventExplorerSortMode,
} from "@/src/features/events/lib/eventExplorerOrdering";
import {
  explorerFilterStickyClass,
  explorerPageGridClass,
} from "@/src/lib/layout/explorerLayout";
import { useUrlSyncedState } from "@/src/lib/navigation/useUrlSyncedState";

import { useEventExplorerFilterBridgePublisher } from "@/src/features/events/client/EventExplorerFilterBridge";

import { ActiveTopicFilters } from "./ActiveTopicFilters";
import { EventGrid } from "./EventGrid";
import { FilterPanel } from "./FilterPanel";
import type { EventFilters, EventRecord } from "./types";

const EVENT_SORT_OPTIONS: { value: EventExplorerSortMode; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "reviewed", label: "Recently Reviewed" },
  { value: "date_asc", label: "Event Date (Oldest First)" },
  { value: "date_desc", label: "Event Date (Newest First)" },
  { value: "name", label: "Event Name" },
];

function eventExplorerFiltersEqual(left: EventFilters, right: EventFilters): boolean {
  return buildEventExplorerFilterKey(left) === buildEventExplorerFilterKey(right);
}

type EventExplorerPageProps = {
  catalog: EventRecord[];
  initialFilters: EventFilters;
  initialFilterFacets: EventExplorerFilterFacets;
};

export function EventExplorerPage({
  catalog,
  initialFilters,
  initialFilterFacets,
}: EventExplorerPageProps) {
  const pathname = usePathname();
  const [filters, setFilters] = useUrlSyncedState({
    initial: initialFilters,
    pathname,
    parse: parseEventExplorerFiltersFromSearchParams,
    serialize: buildEventExplorerSearchParams,
    equals: eventExplorerFiltersEqual,
    history: "replace",
  });
  useEventExplorerFilterBridgePublisher(filters, setFilters);
  const [sort, setSort] = useState<EventExplorerSortMode>(DEFAULT_EVENT_EXPLORER_SORT_MODE);
  const [page, setPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const filterKey = useMemo(() => buildEventExplorerFilterKey(filters), [filters]);

  useEffect(() => {
    setPage(1);
  }, [filterKey]);

  const filterFacets = useMemo(() => {
    const next = buildEventExplorerClientFilterFacets(catalog, filters);
    if (catalog.length === 0) {
      return initialFilterFacets;
    }
    return next;
  }, [catalog, filters, initialFilterFacets]);

  const sortedEvents = useMemo(
    () => buildEventExplorerDisplayEvents(catalog, filters, sort),
    [catalog, filters, sort],
  );

  function handleReset() {
    setFilters({ ...DEFAULT_EVENT_EXPLORER_FILTERS });
    setSort(DEFAULT_EVENT_EXPLORER_SORT_MODE);
    setPage(1);
  }

  function handleClearAllFilters() {
    setFilters({
      ...filters,
      topics: [],
      regions: [],
    });
  }

  function handleRemoveTopic(slug: string) {
    setFilters({
      ...filters,
      topics: toggleTopicSelection(filters.topics, slug, false),
    });
  }

  function handleRemoveCountry(country: string) {
    setFilters({
      ...filters,
      regions: toggleCountrySelection(filters.regions, country, false),
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
            filters={filters}
            countryOptions={filterFacets.countries}
            topicOptions={filterFacets.topics}
            onChange={setFilters}
            onReset={handleReset}
            className={explorerFilterStickyClass}
          />
        </div>

        <div className="space-y-4">
          <ActiveTopicFilters
            topics={filters.topics}
            topicOptions={filterFacets.topics}
            regions={filters.regions}
            countryOptions={filterFacets.countries}
            onRemoveTopic={handleRemoveTopic}
            onRemoveCountry={handleRemoveCountry}
            onClearAll={handleClearAllFilters}
          />
          <ExplorerResultsToolbar
            total={sortedEvents.length}
            entityLabel="events"
            sort={sort}
            sortOptions={EVENT_SORT_OPTIONS}
            onSortChange={setSort}
            onOpenFilters={() => setMobileFiltersOpen(true)}
          />
          <EventGrid
            events={sortedEvents}
            loading={false}
            page={page}
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
          filters={filters}
          countryOptions={filterFacets.countries}
          topicOptions={filterFacets.topics}
          onChange={setFilters}
          onReset={handleReset}
        />
      </MobileFilterDrawer>
    </section>
  );
}
