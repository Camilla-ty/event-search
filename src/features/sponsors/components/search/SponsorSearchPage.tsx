"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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

const SEARCH_DEBOUNCE_MS = 400;

const GLOBAL_SORT_OPTIONS: { value: SponsorDiscoverySort; label: string }[] = [
  { value: "activity", label: "Latest activity" },
  { value: "name", label: "Name" },
  { value: "count", label: "Sponsorship count" },
];

const EVENT_SORT_OPTIONS: { value: SponsorDiscoverySort; label: string }[] = [
  { value: "tier", label: "Tier rank" },
  ...GLOBAL_SORT_OPTIONS,
];

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
  const [isPending, startTransition] = useTransition();

  const [searchDraft, setSearchDraft] = useState(params.query);
  const [committedQuery, setCommittedQuery] = useState(params.query);
  const [eventSlug, setEventSlug] = useState<string | null>(params.eventSlug);
  const [sort, setSort] = useState<SponsorDiscoverySort>(params.sort);
  const [page, setPage] = useState(params.page);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const hasEventFilter = params.eventSlug !== null;
  const showEventTier = hasEventFilter && !eventUnknown;

  const sortOptions = useMemo(
    () => (showEventTier ? EVENT_SORT_OPTIONS : GLOBAL_SORT_OPTIONS),
    [showEventTier],
  );

  const isNavigating =
    isPending ||
    committedQuery !== params.query ||
    eventSlug !== params.eventSlug ||
    sort !== params.sort ||
    page !== params.page;

  useEffect(() => {
    setSearchDraft(params.query);
    setCommittedQuery(params.query);
    setEventSlug(params.eventSlug);
    setSort(params.sort);
    setPage(params.page);
  }, [params.eventSlug, params.page, params.query, params.sort]);

  useEffect(() => {
    const trimmedDraft = searchDraft.trim();
    if (trimmedDraft === committedQuery) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCommittedQuery(trimmedDraft);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [committedQuery, searchDraft]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());

    if (committedQuery !== "") {
      next.set("q", committedQuery);
    } else {
      next.delete("q");
    }

    const activeEventSlug = eventSlug?.trim() ?? "";
    if (activeEventSlug !== "") {
      next.set("event", activeEventSlug);
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
      startTransition(() => {
        router.replace(nextValue ? `${pathname}?${nextValue}` : pathname);
      });
    }
  }, [committedQuery, eventSlug, page, pathname, router, searchParams, sort]);

  function handleSearchChange(query: string) {
    setSearchDraft(query);
  }

  function handleSortChange(next: SponsorDiscoverySort) {
    setSort(next);
    setPage(1);
  }

  function handleReset() {
    setSearchDraft("");
    setCommittedQuery("");
    setEventSlug(null);
    setSort("activity");
    setPage(1);
  }

  function clearEventScope() {
    setEventSlug(null);
    setPage(1);
    if (sort === "tier") {
      setSort("activity");
    }
  }

  const activeEventSlug = eventSlug?.trim() ?? "";
  const showEventBanner = activeEventSlug !== "";

  const filterState: FilterState = {
    query: searchDraft,
    eventSlug,
  };

  return (
    <section className="space-y-4">
      <PageHeader
        title="Sponsors"
        description="Discover companies that sponsor events across EventPixels."
      />

      <div className={explorerPageGridClass}>
        <div className="hidden md:block">
          <FilterPanel
            filters={filterState}
            eventName={eventContext?.name ?? null}
            eventUnknown={eventUnknown}
            onChange={(next) => handleSearchChange(next.query)}
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
            page={params.page}
            pageSize={params.pageSize}
            showEventTier={showEventTier}
            loading={isNavigating}
            eventUnknown={eventUnknown}
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
          filters={filterState}
          eventName={eventContext?.name ?? null}
          eventUnknown={eventUnknown}
          onChange={(next) => handleSearchChange(next.query)}
          onReset={handleReset}
        />
      </MobileFilterDrawer>
    </section>
  );
}
