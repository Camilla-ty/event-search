"use client";

import { Button } from "@/src/components/common";
import { NoResultsState, PageLoadingSkeleton } from "@/src/components/common/states";
import { LogoDevAttribution } from "@/src/components/companies/LogoDevAttribution";

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

export function SponsorList({
  sponsors,
  loading,
  onReset,
  page,
  onPageChange,
}: SponsorListProps) {
  if (loading) {
    return <PageLoadingSkeleton variant="list" />;
  }

  if (sponsors.length === 0) {
    return (
      <NoResultsState
        title="No sponsors found"
        description="Try broadening your filters or search query."
        onReset={onReset}
        resetLabel="Reset filters"
      />
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

      <LogoDevAttribution className="px-1" />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
        <p className="text-slate-600">
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
