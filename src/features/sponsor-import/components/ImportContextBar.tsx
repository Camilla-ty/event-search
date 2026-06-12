"use client";

import Link from "next/link";

import { Button } from "@/src/components/common";
import { secondaryCtaClass } from "@/src/lib/design/classes";

import { ImportBatchStatusBadge } from "./ImportBatchStatusBadge";

type ImportContextBarProps = {
  editionName: string;
  seriesName: string | null;
  editionYear: number;
  editionId: string;
  filename: string;
  status: string;
  rowCount: number;
  progressLabel?: string | null;
  onDiscard: () => void;
};

export function ImportContextBar({
  editionName,
  seriesName,
  editionYear,
  editionId,
  filename,
  status,
  rowCount,
  progressLabel,
  onDiscard,
}: ImportContextBarProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
        <div className="space-y-1">
          <p className="font-medium text-slate-900">
            {seriesName ? `${seriesName} · ` : ""}
            {editionName} ({editionYear})
            <Link
              href={`/admin/events/editions/${editionId}`}
              className="ml-2 cursor-pointer text-brand-primary hover:underline"
            >
              Edit edition
            </Link>
          </p>
          <p className="flex flex-wrap items-center gap-2 text-slate-600">
            <span>{filename}</span>
            <ImportBatchStatusBadge status={status} />
            <span>{rowCount} rows</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/sponsor-imports"
            className={`${secondaryCtaClass} h-9 cursor-pointer px-3 text-sm`}
          >
            Save & exit
          </Link>
          <Button variant="secondary" size="sm" onClick={onDiscard}>
            Discard
          </Button>
        </div>
      </div>
      {progressLabel ? (
        <p
          className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-950"
          role="status"
          aria-live="polite"
        >
          <span
            className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-sky-200 border-t-sky-700"
            aria-hidden
          />
          {progressLabel}
        </p>
      ) : null}
    </div>
  );
}
