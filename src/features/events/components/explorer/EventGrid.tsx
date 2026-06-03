"use client";

import { Button } from "@/src/components/common";
import { NoResultsState, PageLoadingSkeleton } from "@/src/components/common/states";

import { EventCard } from "./EventCard";
import type { EventRecord } from "./types";

const PAGE_SIZE = 9;

type EventGridProps = {
  events: EventRecord[];
  loading: boolean;
  page: number;
  onPageChange: (page: number) => void;
  onReset: () => void;
};

export function EventGrid({ events, loading, page, onPageChange, onReset }: EventGridProps) {
  if (loading) {
    return <PageLoadingSkeleton variant="list" />;
  }

  if (events.length === 0) {
    return (
      <NoResultsState
        title="No events found"
        description="Try broadening your filters and search terms."
        onReset={onReset}
        resetLabel="Reset filters"
      />
    );
  }

  const totalPages = Math.max(1, Math.ceil(events.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = events.slice(start, start + PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {pageItems.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
        <p className="text-slate-600">
          Showing {start + 1} to {Math.min(start + PAGE_SIZE, events.length)} of{" "}
          {events.length.toLocaleString()} events
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
