"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  ExplorerResultsToolbar,
  MobileFilterDrawer,
  PageHeader,
} from "@/src/components/common/explorer";
import type { EventExplorerActiveTopic } from "@/src/features/events/server/getEventExplorerData";
import { brandLinkClass } from "@/src/lib/design/classes";
import {
  explorerFilterStickyClass,
  explorerPageGridClass,
} from "@/src/lib/layout/explorerLayout";
import { buildTopicHubPath } from "@/src/lib/routes/explorerUrls";

import { EventGrid } from "./EventGrid";
import { FilterPanel } from "./FilterPanel";
import type { EventFilters, EventRecord } from "./types";

type SortValue = "date" | "name";

const EVENT_SORT_OPTIONS = [
  { value: "date" as const, label: "Event Date" },
  { value: "name" as const, label: "Event Name" },
];

const defaultFilters: EventFilters = {
  query: "",
  industry: "all",
  region: "all",
  type: "all",
  startDate: "",
  endDate: "",
  topic: "",
};

type EventExplorerPageProps = {
  events: EventRecord[];
  initialFilters?: EventFilters;
  activeTopic?: EventExplorerActiveTopic | null;
  topicUnknown?: boolean;
};

function normalize(value: string | null | undefined) {
  return (value ?? "").toLowerCase();
}

function eventDateValue(input?: string | null) {
  if (!input) return "";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function EventExplorerPage({
  events,
  initialFilters,
  activeTopic = null,
  topicUnknown = false,
}: EventExplorerPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<EventFilters>(initialFilters ?? defaultFilters);
  const [sort, setSort] = useState<SortValue>("date");
  const [page, setPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const topicSlug = (initialFilters?.topic ?? searchParams.get("topic") ?? "").trim();
  const clearTopicHref = useMemo(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("topic");
    const value = next.toString();
    return value ? `${pathname}?${value}` : pathname;
  }, [pathname, searchParams]);
  const topicHubHref =
    activeTopic !== null ? buildTopicHubPath(activeTopic.slug) : null;

  const industries = useMemo(() => {
    const values = events
      .map((event) => event.event_series?.name)
      .filter((name): name is string => Boolean(name?.trim()));
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [events]);

  const regions = useMemo(() => {
    const values = events
      .map((event) => event.cities?.countries?.name)
      .filter((name): name is string => Boolean(name?.trim()));
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [events]);

  const types = useMemo(() => {
    const values = events
      .map((event) => event.event_series?.name)
      .filter((name): name is string => Boolean(name?.trim()));
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [events]);

  const filteredAndSorted = useMemo(() => {
    const filtered = events.filter((event) => {
      const query = normalize(filters.query);
      const eventName = normalize(event.name);
      const cityName = normalize(event.cities?.name);
      const countryName = normalize(event.cities?.countries?.name);
      const seriesName = event.event_series?.name ?? "";
      const regionName = event.cities?.countries?.name ?? "";

      const matchesQuery =
        !query ||
        eventName.includes(query) ||
        cityName.includes(query) ||
        countryName.includes(query);
      const matchesIndustry = filters.industry === "all" || seriesName === filters.industry;
      const matchesRegion = filters.region === "all" || regionName === filters.region;
      const matchesType = filters.type === "all" || seriesName === filters.type;

      const startValue = eventDateValue(event.start_date);
      const endValue = eventDateValue(event.end_date ?? event.start_date);
      const afterStart = !filters.startDate || !endValue || endValue >= filters.startDate;
      const beforeEnd = !filters.endDate || !startValue || startValue <= filters.endDate;

      return matchesQuery && matchesIndustry && matchesRegion && matchesType && afterStart && beforeEnd;
    });

    return filtered.sort((a, b) => {
      if (sort === "name") {
        return (a.name ?? "").localeCompare(b.name ?? "");
      }
      const aValue = eventDateValue(a.start_date);
      const bValue = eventDateValue(b.start_date);
      if (!aValue && !bValue) return 0;
      if (!aValue) return 1;
      if (!bValue) return -1;
      return aValue.localeCompare(bValue);
    });
  }, [events, filters, sort]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());
    if (filters.query.trim()) next.set("q", filters.query.trim());
    else next.delete("q");

    if (filters.industry !== "all") next.set("industry", filters.industry);
    else next.delete("industry");

    if (filters.region !== "all") next.set("region", filters.region);
    else next.delete("region");

    if (filters.type !== "all") next.set("type", filters.type);
    else next.delete("type");

    if (filters.startDate) next.set("start", filters.startDate);
    else next.delete("start");

    if (filters.endDate) next.set("end", filters.endDate);
    else next.delete("end");

    if (topicSlug !== "") next.set("topic", topicSlug);
    else next.delete("topic");

    const current = searchParams.toString();
    const nextValue = next.toString();
    if (current !== nextValue) {
      router.replace(nextValue ? `${pathname}?${nextValue}` : pathname);
    }
  }, [filters, pathname, router, searchParams, topicSlug]);

  function handleReset() {
    setFilters({
      ...(initialFilters ?? defaultFilters),
      topic: topicSlug,
    });
    setSort("date");
    setPage(1);
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
            industries={industries}
            regions={regions}
            types={types}
            onChange={setFilters}
            onReset={handleReset}
            className={explorerFilterStickyClass}
          />
        </div>

        <div className="space-y-4">
          {topicSlug !== "" ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-primary/20 bg-brand-primary-muted px-4 py-3 text-sm text-slate-700">
              <span className="font-medium text-slate-900">
                Topic:{" "}
                {activeTopic ? (
                  topicHubHref ? (
                    <Link href={topicHubHref} className={brandLinkClass}>
                      {activeTopic.name}
                    </Link>
                  ) : (
                    activeTopic.name
                  )
                ) : topicUnknown ? (
                  `${topicSlug} (not found)`
                ) : (
                  topicSlug
                )}
              </span>
              <Link href={clearTopicHref} className={`${brandLinkClass} ml-auto`}>
                Clear topic
              </Link>
            </div>
          ) : null}
          <ExplorerResultsToolbar
            total={filteredAndSorted.length}
            entityLabel="events"
            sort={sort}
            sortOptions={EVENT_SORT_OPTIONS}
            onSortChange={setSort}
            onOpenFilters={() => setMobileFiltersOpen(true)}
          />
          <EventGrid
            events={filteredAndSorted}
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
          industries={industries}
          regions={regions}
          types={types}
          onChange={setFilters}
          onReset={handleReset}
        />
      </MobileFilterDrawer>
    </section>
  );
}
