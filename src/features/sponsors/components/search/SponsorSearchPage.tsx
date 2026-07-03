"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  ExplorerResultsToolbar,
  PageHeader,
} from "@/src/components/common/explorer";
import type { SponsorDiscoveryParams } from "@/src/features/sponsors/server/sponsorDiscoveryTypes";
import { SPONSOR_DISCOVERY_DEFAULT_SORT } from "@/src/features/sponsors/server/sponsorDiscoveryParams";

import type { SponsorDiscoveryRow, SponsorDiscoverySort } from "./discoveryTypes";
import { SponsorDiscoveryList } from "./SponsorDiscoveryList";
import { SponsorEventContextBanner } from "./SponsorEventContextBanner";
import type { SponsorEventContext } from "./types";

const GLOBAL_SORT_OPTIONS: { value: SponsorDiscoverySort; label: string }[] = [
  { value: "count", label: "Most events sponsored" },
  { value: "activity", label: "Latest activity" },
  { value: "name", label: "Name" },
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

  const [eventSlug, setEventSlug] = useState<string | null>(params.eventSlug);
  const [sort, setSort] = useState<SponsorDiscoverySort>(params.sort);
  const [page, setPage] = useState(params.page);

  const hasEventFilter = params.eventSlug !== null;
  const showEventTier = hasEventFilter && !eventUnknown;

  const sortOptions = useMemo(
    () => (showEventTier ? EVENT_SORT_OPTIONS : GLOBAL_SORT_OPTIONS),
    [showEventTier],
  );

  const isNavigating =
    isPending ||
    eventSlug !== params.eventSlug ||
    sort !== params.sort ||
    page !== params.page;

  useEffect(() => {
    setEventSlug(params.eventSlug);
    setSort(params.sort);
    setPage(params.page);
  }, [params.eventSlug, params.page, params.sort]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());

    const activeEventSlug = eventSlug?.trim() ?? "";
    if (activeEventSlug !== "") {
      next.set("event", activeEventSlug);
    } else {
      next.delete("event");
    }

    if (sort !== SPONSOR_DISCOVERY_DEFAULT_SORT) {
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
  }, [eventSlug, page, pathname, router, searchParams, sort]);

  function handleSortChange(next: SponsorDiscoverySort) {
    setSort(next);
    setPage(1);
  }

  function clearEventScope() {
    setEventSlug(null);
    setPage(1);
    if (sort === "tier") {
      setSort(SPONSOR_DISCOVERY_DEFAULT_SORT);
    }
  }

  const activeEventSlug = eventSlug?.trim() ?? "";
  const showEventBanner = activeEventSlug !== "";

  return (
    <section className="space-y-4">
      <PageHeader
        title="Sponsors"
        description="Discover companies that sponsor events across EventPixels."
      />

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
        />
      </div>
    </section>
  );
}
