"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  ExplorerResultsToolbar,
  MobileFilterDrawer,
  PageHeader,
} from "@/src/components/common/explorer";
import type { EventExplorerFilterFacets } from "@/src/features/events/lib/eventExplorerFilterFacets";
import { toggleCountrySelection } from "@/src/features/events/lib/filterPanelCountries";
import { toggleTopicSelection } from "@/src/features/events/lib/filterPanelTopics";
import { applyOptimisticCountryDisplayFilter, isRegionOptimisticDisplaySufficient } from "@/src/features/events/lib/eventOptimisticCountryFilter";
import { applyOptimisticTopicDisplayFilter, isTopicOptimisticDisplaySufficient } from "@/src/features/events/lib/eventOptimisticTopicFilter";
import {
  buildEventExplorerFilterKey,
  buildEventExplorerSearchParams,
  DEFAULT_EVENT_EXPLORER_FILTERS,
  eventExplorerClientUrlMatchesDraft,
  isEventExplorerFiltersApplying,
  parseEventExplorerFiltersFromSearchParams,
} from "@/src/features/events/lib/eventExplorerQuery";
import {
  DEFAULT_EVENT_EXPLORER_SORT_MODE,
  sortEventExplorerResults,
  type EventExplorerSortMode,
} from "@/src/features/events/lib/eventExplorerOrdering";
import {
  explorerFilterStickyClass,
  explorerPageGridClass,
} from "@/src/lib/layout/explorerLayout";

import { ActiveTopicFilters } from "./ActiveTopicFilters";
import { EventGrid } from "./EventGrid";
import { FilterApplyingIndicator } from "./FilterApplyingIndicator";
import { FilterPanel } from "./FilterPanel";
import type { EventFilters, EventRecord } from "./types";

const EVENT_SORT_OPTIONS: { value: EventExplorerSortMode; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "reviewed", label: "Recently Reviewed" },
  { value: "date_asc", label: "Event Date (Oldest First)" },
  { value: "date_desc", label: "Event Date (Newest First)" },
  { value: "name", label: "Event Name" },
];

type EventExplorerPageProps = {
  events: EventRecord[];
  initialFilters?: EventFilters;
  filterFacets: EventExplorerFilterFacets;
};

export function EventExplorerPage({
  events,
  initialFilters,
  filterFacets,
}: EventExplorerPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const appliedFilters = useMemo(
    () => parseEventExplorerFiltersFromSearchParams(searchParams),
    [searchParams],
  );
  const [draftFilters, setDraftFilters] = useState<EventFilters>(appliedFilters);
  const skipUrlSyncRef = useRef(false);
  const [sort, setSort] = useState<EventExplorerSortMode>(DEFAULT_EVENT_EXPLORER_SORT_MODE);
  const [page, setPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const appliedFilterKey = useMemo(
    () => buildEventExplorerFilterKey(appliedFilters),
    [appliedFilters],
  );
  const serverFilters = initialFilters ?? appliedFilters;
  const isFiltersApplying = useMemo(
    () =>
      isEventExplorerFiltersApplying({
        draftFilters,
        appliedFilters,
        serverFilters,
        isTransitionPending: isPending,
      }),
    [appliedFilters, draftFilters, isPending, serverFilters],
  );
  const showResultsApplyingState = useMemo(
    () =>
      isFiltersApplying &&
      !isTopicOptimisticDisplaySufficient(draftFilters.topics, serverFilters.topics) &&
      !isRegionOptimisticDisplaySufficient(draftFilters.regions, serverFilters.regions),
    [
      draftFilters.regions,
      draftFilters.topics,
      isFiltersApplying,
      serverFilters.regions,
      serverFilters.topics,
    ],
  );

  const sortedEvents = useMemo(() => {
    const displayEvents = applyOptimisticCountryDisplayFilter(
      applyOptimisticTopicDisplayFilter(events, {
        draftTopics: draftFilters.topics,
        serverTopics: serverFilters.topics,
        isFiltersApplying,
      }),
      {
        draftRegions: draftFilters.regions,
        serverRegions: serverFilters.regions,
        isFiltersApplying,
      },
    );

    return sortEventExplorerResults(displayEvents, {
      query: appliedFilters.query,
      sortMode: sort,
    });
  }, [
    appliedFilters.query,
    draftFilters.regions,
    draftFilters.topics,
    events,
    isFiltersApplying,
    serverFilters.regions,
    serverFilters.topics,
    sort,
  ]);

  useEffect(() => {
    setDraftFilters(appliedFilters);
    skipUrlSyncRef.current = true;
  }, [appliedFilters]);

  useEffect(() => {
    setPage(1);
  }, [appliedFilterKey]);

  useEffect(() => {
    if (skipUrlSyncRef.current) {
      skipUrlSyncRef.current = false;
      return;
    }

    const next = buildEventExplorerSearchParams(draftFilters);
    if (eventExplorerClientUrlMatchesDraft(searchParams, draftFilters)) {
      return;
    }

    const nextValue = next.toString();
    startTransition(() => {
      router.replace(nextValue ? `${pathname}?${nextValue}` : pathname);
    });
  }, [draftFilters, pathname, router, searchParams]);

  function handleReset() {
    setDraftFilters({ ...DEFAULT_EVENT_EXPLORER_FILTERS });
    setSort(DEFAULT_EVENT_EXPLORER_SORT_MODE);
    setPage(1);
  }

  function handleClearAllFilters() {
    setDraftFilters({
      ...draftFilters,
      topics: [],
      regions: [],
    });
  }

  function handleRemoveTopic(slug: string) {
    setDraftFilters({
      ...draftFilters,
      topics: toggleTopicSelection(draftFilters.topics, slug, false),
    });
  }

  function handleRemoveCountry(country: string) {
    setDraftFilters({
      ...draftFilters,
      regions: toggleCountrySelection(draftFilters.regions, country, false),
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
            filters={draftFilters}
            countryOptions={filterFacets.countries}
            topicOptions={filterFacets.topics}
            onChange={setDraftFilters}
            onReset={handleReset}
            className={explorerFilterStickyClass}
          />
        </div>

        <div className="space-y-4">
          <ActiveTopicFilters
            topics={draftFilters.topics}
            topicOptions={filterFacets.topics}
            regions={draftFilters.regions}
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
          <FilterApplyingIndicator visible={showResultsApplyingState} />
          <div
            className={
              showResultsApplyingState
                ? "opacity-60 transition-opacity duration-200"
                : "transition-opacity duration-200"
            }
          >
            <EventGrid
              events={sortedEvents}
              loading={false}
              page={page}
              onPageChange={setPage}
              onReset={handleReset}
            />
          </div>
        </div>
      </div>

      <MobileFilterDrawer
        open={mobileFiltersOpen}
        onClose={() => setMobileFiltersOpen(false)}
      >
        <FilterPanel
          filters={draftFilters}
          countryOptions={filterFacets.countries}
          topicOptions={filterFacets.topics}
          onChange={setDraftFilters}
          onReset={handleReset}
        />
      </MobileFilterDrawer>
    </section>
  );
}
