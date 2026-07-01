"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  ExplorerResultsToolbar,
  MobileFilterDrawer,
  PageHeader,
} from "@/src/components/common/explorer";
import type { EventExplorerFilterFacets } from "@/src/features/events/lib/eventExplorerFilterFacets";
import { toggleTopicSelection } from "@/src/features/events/lib/filterPanelTopics";
import {
  eventsIntersectMonth,
  formatCalendarMonthLabel,
  getCurrentMonthKey,
} from "@/src/features/events/lib/eventCalendarGrouping";
import { buildCalendarToolbarCounts } from "@/src/features/events/lib/eventExplorerCounts";
import {
  buildEventExplorerSearchParams,
  DEFAULT_EVENT_EXPLORER_FILTERS,
  isEventExplorerFiltersApplying,
  parseEventExplorerFiltersFromSearchParams,
} from "@/src/features/events/lib/eventExplorerQuery";
import {
  sortEventExplorerResults,
  type EventExplorerSortMode,
} from "@/src/features/events/lib/eventExplorerOrdering";
import {
  explorerFilterStickyClass,
  explorerPageGridClass,
} from "@/src/lib/layout/explorerLayout";
import {
  parseEventExplorerMonth,
  parseEventExplorerView,
} from "@/src/lib/routes/explorerUrls";

import { ActiveTopicFilters } from "./ActiveTopicFilters";
import { EventCalendar } from "./EventCalendar";
import { EventGrid } from "./EventGrid";
import { EventViewToggle } from "./EventViewToggle";
import { FilterApplyingIndicator } from "./FilterApplyingIndicator";
import { FilterPanel } from "./FilterPanel";
import type { EventFilters, EventRecord, ExplorerView } from "./types";

const EVENT_SORT_OPTIONS: { value: EventExplorerSortMode; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "date", label: "Event Date" },
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
  const [sort, setSort] = useState<EventExplorerSortMode>("recommended");
  const [page, setPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const explorerView = parseEventExplorerView(searchParams.get("view"));
  const calendarMonth = parseEventExplorerMonth(searchParams.get("month"));
  const defaultCalendarMonth = useMemo(() => {
    const fromStartFilter = parseEventExplorerMonth(
      appliedFilters.startDate.slice(0, 7),
    );
    if (fromStartFilter !== null) return fromStartFilter;
    return getCurrentMonthKey();
  }, [appliedFilters.startDate]);
  const visibleCalendarMonth = calendarMonth ?? defaultCalendarMonth;
  const appliedFilterKey = useMemo(
    () => buildEventExplorerSearchParams(appliedFilters).toString(),
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

  const sortedEvents = useMemo(() => {
    return sortEventExplorerResults(events, {
      query: appliedFilters.query,
      sortMode: sort,
    });
  }, [appliedFilters.query, events, sort]);

  const calendarToolbarCounts = useMemo(() => {
    if (explorerView !== "calendar") return null;

    const totalMatchingCount = sortedEvents.length;
    const monthEventCount = eventsIntersectMonth(
      sortedEvents,
      visibleCalendarMonth,
    ).length;
    const monthLabel = formatCalendarMonthLabel(visibleCalendarMonth);

    return buildCalendarToolbarCounts(monthEventCount, monthLabel, totalMatchingCount);
  }, [explorerView, sortedEvents, visibleCalendarMonth]);

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

    const next = buildEventExplorerSearchParams(draftFilters, {
      view: explorerView === "calendar" ? "calendar" : undefined,
      month: visibleCalendarMonth,
    });
    const current = searchParams.toString();
    const nextValue = next.toString();
    if (current !== nextValue) {
      startTransition(() => {
        router.replace(nextValue ? `${pathname}?${nextValue}` : pathname);
      });
    }
  }, [
    draftFilters,
    explorerView,
    pathname,
    router,
    searchParams,
    visibleCalendarMonth,
  ]);

  function buildExplorerSearchParams(options?: { view?: ExplorerView; month?: string }) {
    const nextView = options?.view ?? explorerView;
    return buildEventExplorerSearchParams(draftFilters, {
      view: nextView === "calendar" ? "calendar" : undefined,
      month: options?.month ?? visibleCalendarMonth,
    });
  }

  function replaceExplorerUrl(options?: { view?: ExplorerView; month?: string }) {
    const next = buildExplorerSearchParams(options);
    const nextValue = next.toString();
    startTransition(() => {
      router.replace(nextValue ? `${pathname}?${nextValue}` : pathname);
    });
  }

  function handleViewChange(nextView: ExplorerView) {
    if (nextView === "list") {
      setPage(1);
    }

    replaceExplorerUrl({
      view: nextView,
      month: nextView === "calendar" ? visibleCalendarMonth : undefined,
    });
  }

  function handleCalendarMonthChange(month: string) {
    replaceExplorerUrl({ view: "calendar", month });
  }

  function handleReset() {
    setDraftFilters({ ...DEFAULT_EVENT_EXPLORER_FILTERS });
    setSort("date");
    setPage(1);
  }

  function handleClearTopics() {
    setDraftFilters({
      ...draftFilters,
      topics: [],
    });
  }

  function handleRemoveTopic(slug: string) {
    setDraftFilters({
      ...draftFilters,
      topics: toggleTopicSelection(draftFilters.topics, slug, false),
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
            seriesOptions={filterFacets.series}
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
            onRemoveTopic={handleRemoveTopic}
            onClearAll={handleClearTopics}
          />
          <div className="flex flex-wrap items-center gap-3">
            <EventViewToggle view={explorerView} onViewChange={handleViewChange} />
            <div className="min-w-0 flex-1">
              <ExplorerResultsToolbar
                total={sortedEvents.length}
                entityLabel="events"
                sort={sort}
                sortOptions={EVENT_SORT_OPTIONS}
                onSortChange={setSort}
                onOpenFilters={() => setMobileFiltersOpen(true)}
                showSort={explorerView === "list"}
                calendarCounts={calendarToolbarCounts}
              />
            </div>
          </div>
          <FilterApplyingIndicator visible={isFiltersApplying} />
          <div
            className={
              isFiltersApplying
                ? "opacity-60 transition-opacity duration-200"
                : "transition-opacity duration-200"
            }
          >
            {explorerView === "list" ? (
              <EventGrid
                events={sortedEvents}
                loading={false}
                page={page}
                onPageChange={setPage}
                onReset={handleReset}
              />
            ) : (
              <EventCalendar
                events={sortedEvents}
                month={visibleCalendarMonth}
                onMonthChange={handleCalendarMonthChange}
              />
            )}
          </div>
        </div>
      </div>

      <MobileFilterDrawer
        open={mobileFiltersOpen}
        onClose={() => setMobileFiltersOpen(false)}
      >
        <FilterPanel
          filters={draftFilters}
          seriesOptions={filterFacets.series}
          countryOptions={filterFacets.countries}
          topicOptions={filterFacets.topics}
          onChange={setDraftFilters}
          onReset={handleReset}
        />
      </MobileFilterDrawer>
    </section>
  );
}
