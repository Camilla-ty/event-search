"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { EventGrid } from "./EventGrid";
import { FilterPanel } from "./FilterPanel";
import { ResultsToolbar } from "./ResultsToolbar";
import type { EventFilters, EventRecord } from "./types";

type SortValue = "date" | "name";
type ViewValue = "grid";

const defaultFilters: EventFilters = {
  query: "",
  industry: "all",
  region: "all",
  type: "all",
  startDate: "",
  endDate: "",
};

type EventExplorerPageProps = {
  events: EventRecord[];
  initialFilters?: EventFilters;
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
}: EventExplorerPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<EventFilters>(initialFilters ?? defaultFilters);
  const [sort, setSort] = useState<SortValue>("date");
  const [view] = useState<ViewValue>("grid");
  const [page, setPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

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

    const current = searchParams.toString();
    const nextValue = next.toString();
    if (current !== nextValue) {
      router.replace(nextValue ? `${pathname}?${nextValue}` : pathname);
    }
  }, [filters, pathname, router, searchParams]);

  function handleReset() {
    setFilters(defaultFilters);
    setSort("date");
    setPage(1);
  }

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Events Explorer</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Discover events, analyze sponsor activity, and find new opportunities.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="hidden lg:block">
          <FilterPanel
            filters={filters}
            industries={industries}
            regions={regions}
            types={types}
            onChange={setFilters}
            onReset={handleReset}
            className="sticky top-6"
          />
        </div>

        <div className="space-y-4">
          <ResultsToolbar
            total={filteredAndSorted.length}
            sort={sort}
            view={view}
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

      {mobileFiltersOpen ? (
        <div className="fixed inset-0 z-50 bg-black/50 lg:hidden" onClick={() => setMobileFiltersOpen(false)}>
          <div
            className="absolute inset-y-0 left-0 w-[88%] max-w-sm overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Filters</h2>
              <button
                type="button"
                className="text-sm text-slate-500 dark:text-slate-300"
                onClick={() => setMobileFiltersOpen(false)}
              >
                Close
              </button>
            </div>
            <FilterPanel
              filters={filters}
              industries={industries}
              regions={regions}
              types={types}
              onChange={setFilters}
              onReset={handleReset}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
