"use client";

import { Button } from "@/src/components/common";
import { NoResultsState } from "@/src/components/common/states";
import type { EventExplorerRow } from "@/src/features/events/server/eventExplorerTypes";
import { eventExplorerTotalPages } from "@/src/features/events/server/eventExplorerParams";

import { EventCard } from "./EventCard";
import { EventCardSkeletonList } from "./EventCardSkeleton";

const paginationFooterClass =
  "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm";

type EventGridProps = {
  rows: EventExplorerRow[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  onPageChange: (page: number) => void;
  onReset: () => void;
};

function EventGridPaginationPlaceholder() {
  return (
    <div
      className={paginationFooterClass}
      data-pagination="loading"
      aria-hidden="true"
    >
      {/* Invisible range copy reserves the same footer height as loaded pagination. */}
      <p className="invisible select-none">Showing 1 to 20 of 999 events</p>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" disabled>
          Previous
        </Button>
        <span className="text-slate-400">– / –</span>
        <Button variant="ghost" size="sm" disabled>
          Next
        </Button>
      </div>
    </div>
  );
}

export function EventGrid({
  rows,
  total,
  page,
  pageSize,
  loading,
  onPageChange,
  onReset,
}: EventGridProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <EventCardSkeletonList />
        <EventGridPaginationPlaceholder />
      </div>
    );
  }

  if (total === 0) {
    return (
      <NoResultsState
        title="No events found"
        description="Try broadening your filters and search terms."
        onReset={onReset}
        resetLabel="Reset filters"
      />
    );
  }

  const totalPages = eventExplorerTotalPages(total, pageSize);
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {rows.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>

      <div className={paginationFooterClass}>
        <p className="text-slate-600">
          Showing {start + 1} to {Math.min(start + pageSize, total)} of{" "}
          {total.toLocaleString()} events
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            Previous
          </Button>
          <span className="text-slate-700">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
