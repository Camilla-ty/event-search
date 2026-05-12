"use client";

import { Button } from "@/src/components/common";

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

function GridSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-48 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800"
          />
        ))}
      </div>
    </div>
  );
}

export function EventGrid({ events, loading, page, onPageChange, onReset }: EventGridProps) {
  if (loading) return <GridSkeleton />;

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">No events found</h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Try broadening your filters and search terms.
        </p>
        <div className="mt-4">
          <Button variant="secondary" onClick={onReset}>
            Reset Filters
          </Button>
        </div>
      </div>
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

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-slate-600 dark:text-slate-300">
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
          <span className="text-slate-700 dark:text-slate-200">
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
