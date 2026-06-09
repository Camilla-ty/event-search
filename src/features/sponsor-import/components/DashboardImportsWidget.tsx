import Link from "next/link";

import { defaultStepForBatchStatus, flowHref } from "../client/resumeStep";
import type { SponsorImportBatchStatus } from "../types";
import { ImportBatchStatusBadge } from "./ImportBatchStatusBadge";

export type DashboardImportRow = {
  id: string;
  status: string;
  source_filename: string;
  source_row_count: number;
  edition_name: string;
  edition_year: number;
  series_name: string | null;
  event_edition_id: string;
};

export function DashboardImportsWidget({ batches }: { batches: DashboardImportRow[] }) {
  if (batches.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600">
        <p className="font-medium text-slate-900">Sponsor imports</p>
        <p className="mt-1">No imports in progress.</p>
        <Link href="/admin/sponsor-imports/new" className="mt-2 inline-block text-brand-primary hover:underline">
          Start new import →
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-slate-900">Imports in progress</p>
        <Link href="/admin/sponsor-imports" className="text-sm text-brand-primary hover:underline">
          View all
        </Link>
      </div>
      <ul className="mt-3 divide-y divide-slate-100">
        {batches.map((batch) => {
          const step = defaultStepForBatchStatus(batch.status as SponsorImportBatchStatus);
          return (
            <li key={batch.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <div>
                <p className="font-medium text-slate-900">{batch.source_filename}</p>
                <p className="text-slate-600">
                  {batch.series_name ? `${batch.series_name} · ` : ""}
                  {batch.edition_name} ({batch.edition_year}) · {batch.source_row_count} rows
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ImportBatchStatusBadge status={batch.status} />
                <Link href={flowHref(batch.id, step)} className="text-brand-primary hover:underline">
                  Resume
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
