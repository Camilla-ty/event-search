"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  ExplorerResultsToolbar,
  MobileFilterDrawer,
  PageHeader,
} from "@/src/components/common/explorer";
import {
  explorerFilterStickyClass,
  explorerPageGridClass,
} from "@/src/lib/layout/explorerLayout";
import type { SponsorDiscoveryParams } from "@/src/features/sponsors/server/sponsorDiscoveryTypes";

import type { SponsorDiscoveryRow, SponsorDiscoverySort } from "./discoveryTypes";
import { FilterPanel } from "./FilterPanel";
import { SponsorDiscoveryList } from "./SponsorDiscoveryList";
import { SponsorEventContextBanner } from "./SponsorEventContextBanner";
import type { FilterState, SponsorEventContext } from "./types";

const GLOBAL_SORT_OPTIONS: { value: SponsorDiscoverySort; label: string }[] = [
  { value: "activity", label: "Latest activity" },
  { value: "name", label: "Name" },
  { value: "count", label: "Sponsorship count" },
];

const EVENT_SORT_OPTIONS: { value: SponsorDiscoverySort; label: string }[] = [
  { value: "tier", label: "Tier rank" },
  ...GLOBAL_SORT_OPTIONS,
];

const defaultFilters: FilterState = {
  query: "",
  eventSlug: null,
};

type SponsorSearchPageProps = {
  rows: SponsorDiscoveryRow[];
  total: number;
  params: SponsorDiscoveryParams;
  eventContext: SponsorEventContext | null;
  eventUnknown: boolean;
};

export function SponsorSearchPage({
  rows,
  total,
  params,
  eventContext = null,
  eventUnknown = false,
}: SponsorSearchPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<FilterState>({
    query: params.query,
    eventSlug: params.eventSlug,
  });
  const [sort, setSort] = useState<SponsorDiscoverySort>(params.sort);
  const [page, setPage] = useState(params.page);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const hasEventFilter = params.eventSlug !== null;
  const showEventTier = hasEventFilter && !eventUnknown;

  const sortOptions = useMemo(
    () => (showEventTier ? EVENT_SORT_OPTIONS : GLOBAL_SORT_OPTIONS),
    [showEventTier],
  );

  useEffect(() => {
    setFilters({
      query: params.query,
      eventSlug: params.eventSlug,
    });
    setSort(params.sort);
    setPage(params.page);
  }, [params.eventSlug, params.page, params.query, params.sort]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());

    if (filters.query.trim()) {
      next.set("q", filters.query.trim());
    } else {
      next.delete("q");
    }

    const eventSlug = filters.eventSlug?.trim() ?? "";
    if (eventSlug !== "") {
      next.set("event", eventSlug);
    } else {
      next.delete("event");
    }

    if (sort !== "activity") {
      next.set("sort", sort);
    } else {
      next.delete("sort");
    }

    if (page !== 1) {
      next.set("page", String(page));
    } else {
      next.delete("page");
    }

    next.delete("industry");

    const current = searchParams.toString();
    const nextValue = next.toString();
    if (current !== nextValue) {
      router.replace(nextValue ? `${pathname}?${nextValue}` : pathname);
    }
  }, [filters, page, pathname, router, searchParams, sort]);

  function handleFilterChange(next: FilterState) {
    setFilters(next);
    setPage(1);
  }

  function handleSortChange(next: SponsorDiscoverySort) {
    setSort(next);
    setPage(1);
  }

  function handleReset() {
    setFilters(defaultFilters);
    setSort("activity");
    setPage(1);
  }

  function clearEventScope() {
    setFilters((current) => ({ ...current, eventSlug: null }));
    setPage(1);
  }

  const activeEventSlug = filters.eventSlug?.trim() ?? "";
  const showEventBanner = activeEventSlug !== "";

  return (
    <section className="space-y-4">
      <PageHeader
        title="Sponsors"
        description="Discover companies that sponsor events across EventPixels."
      />

      <div className={explorerPageGridClass}>
        <div className="hidden md:block">
          <FilterPanel
            filters={filters}
            eventName={eventContext?.name ?? null}
            eventUnknown={eventUnknown}
            onChange={handleFilterChange}
            onReset={handleReset}
            className={explorerFilterStickyClass}
          />
        </div>

        <div className="space-y-4">
          {showEventBanner ? (
            <SponsorEventContextBanner
              eventSlug={activeEventSlug}
              eventName={eventContext?.name ?? null}
              eventUnknown={eventUnknown}
              onClear={clearEventScope}
            />
          ) : null}
          <ExplorerResultsToolbar
            total={total}
            entityLabel="sponsors"
            sort={sort}
            sortOptions={sortOptions}
            onSortChange={handleSortChange}
            onOpenFilters={() => setMobileFiltersOpen(true)}
          />
          <SponsorDiscoveryList
            rows={rows}
            total={total}
            page={page}
            pageSize={params.pageSize}
            showEventTier={showEventTier}
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
          eventName={eventContext?.name ?? null}
          eventUnknown={eventUnknown}
          onChange={handleFilterChange}
          onReset={handleReset}
        />
      </MobileFilterDrawer>
    </section>
  );
}
