"use client";

import { useMemo } from "react";

import {
  ExplorerResultsToolbar,
  PageHeader,
} from "@/src/components/common/explorer";
import { InlineErrorBanner, LoadingStatus } from "@/src/components/common";
import { useSponsorDiscoveryCollection } from "@/src/features/sponsors/client/useSponsorDiscoveryCollection";
import { useSponsorDiscoverySearchBridgePublisher } from "@/src/features/sponsors/client/SponsorDiscoverySearchBridge";
import type { SponsorDiscoveryResult } from "@/src/features/sponsors/server/sponsorDiscoveryTypes";

import type { SponsorDiscoverySort } from "./discoveryTypes";
import { SponsorDiscoveryList } from "./SponsorDiscoveryList";
import { SponsorEventContextBanner } from "./SponsorEventContextBanner";

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
  initial: SponsorDiscoveryResult;
};

export function SponsorSearchPage({ initial }: SponsorSearchPageProps) {
  const {
    rows,
    total,
    params,
    eventContext,
    eventUnknown,
    isLoading,
    error,
    setSort,
    setPage,
    setQuery,
    clearEventScope,
  } = useSponsorDiscoveryCollection(initial);

  useSponsorDiscoverySearchBridgePublisher(params.query, setQuery);

  const hasEventFilter = params.eventSlug !== null;
  const showEventTier = hasEventFilter && !eventUnknown;

  const sortOptions = useMemo(
    () => (showEventTier ? EVENT_SORT_OPTIONS : GLOBAL_SORT_OPTIONS),
    [showEventTier],
  );

  const activeEventSlug = params.eventSlug?.trim() ?? "";
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
          sort={params.sort}
          sortOptions={sortOptions}
          onSortChange={setSort}
        />
        {error !== null ? (
          <InlineErrorBanner message={error} />
        ) : null}
        {isLoading && rows.length > 0 ? (
          <LoadingStatus message="Updating results…" />
        ) : null}
        <SponsorDiscoveryList
          rows={rows}
          total={total}
          page={params.page}
          pageSize={params.pageSize}
          showEventTier={showEventTier}
          loading={isLoading}
          eventUnknown={eventUnknown}
          onPageChange={setPage}
        />
      </div>
    </section>
  );
}
