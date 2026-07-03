"use client";

import { Button } from "@/src/components/common";
import { NoResultsState, PageLoadingSkeleton } from "@/src/components/common/states";

import type { SponsorDiscoveryRow } from "./discoveryTypes";
import { SponsorDiscoveryTable } from "./SponsorDiscoveryTable";

type SponsorDiscoveryListProps = {
  rows: SponsorDiscoveryRow[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** Pass true when a valid ?event= filter is active. */
  showEventTier?: boolean;
  loading?: boolean;
  eventUnknown?: boolean;
  onReset?: () => void;
};

export function SponsorDiscoveryList({
  rows,
  total,
  page,
  pageSize,
  onPageChange,
  showEventTier = false,
  loading = false,
  eventUnknown = false,
  onReset,
}: SponsorDiscoveryListProps) {
  if (loading) {
    return <PageLoadingSkeleton variant="list" />;
  }

  if (eventUnknown && total === 0) {
    return null;
  }

  if (total === 0 || rows.length === 0) {
    return (
      <NoResultsState
        title="No sponsors found"
        description="Try broadening your filters or search query."
        onReset={onReset}
        resetLabel="Reset filters"
      />
    );
  }

  const safePageSize = pageSize > 0 ? pageSize : 1;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const normalizedPage = Math.min(Math.max(page, 1), totalPages);
  const start = (normalizedPage - 1) * safePageSize;
  const end = Math.min(start + rows.length, total);

  return (
    <div className="space-y-4">
      <SponsorDiscoveryTable rows={rows} showEventTier={showEventTier} />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
        <p className="text-slate-600">
          Showing {start + 1} to {end} of {total.toLocaleString()} results
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={normalizedPage === 1}
            onClick={() => onPageChange(normalizedPage - 1)}
          >
            Previous
          </Button>
          <span className="text-slate-700">
            {normalizedPage} / {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={normalizedPage === totalPages}
            onClick={() => onPageChange(normalizedPage + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
