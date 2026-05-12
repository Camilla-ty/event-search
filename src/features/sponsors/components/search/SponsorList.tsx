"use client";

import { Button } from "@/src/components/common";

import { SponsorCard } from "./SponsorCard";
import type { SponsorRecord } from "./types";

const PAGE_SIZE = 10;

type SponsorListProps = {
  sponsors: SponsorRecord[];
  loading: boolean;
  onReset: () => void;
  page: number;
  onPageChange: (page: number) => void;
};

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800"
        />
      ))}
    </div>
  );
}

export function SponsorList({
  sponsors,
  loading,
  onReset,
  page,
  onPageChange,
}: SponsorListProps) {
  if (loading) {
    return <LoadingSkeleton />;
  }

  if (sponsors.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">No sponsors found</h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Try broadening your filters or search query.
        </p>
        <div className="mt-4">
          <Button variant="secondary" onClick={onReset}>
            Reset Filters
          </Button>
        </div>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(sponsors.length / PAGE_SIZE));
  const normalizedPage = Math.min(page, totalPages);
  const start = (normalizedPage - 1) * PAGE_SIZE;
  const paged = sponsors.slice(start, start + PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {paged.map((sponsor) => (
          <SponsorCard key={sponsor.id} sponsor={sponsor} />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-slate-600 dark:text-slate-300">
          Showing {start + 1} to {Math.min(start + PAGE_SIZE, sponsors.length)} of{" "}
          {sponsors.length.toLocaleString()} results
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
          <span className="text-slate-700 dark:text-slate-200">
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
