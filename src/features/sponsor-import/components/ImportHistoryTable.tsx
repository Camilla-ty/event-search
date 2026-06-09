"use client";

import Link from "next/link";

import { defaultStepForBatchStatus, flowHref } from "../client/resumeStep";
import { ImportBatchStatusBadge } from "./ImportBatchStatusBadge";

export type ImportHistoryRow = {
  id: string;
  status: string;
  source_filename: string;
  source_row_count: number;
  created_at: string;
  edition_name: string;
  edition_year: number;
  series_name: string | null;
  event_edition_id: string;
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function ImportHistoryTable({ batches }: { batches: ImportHistoryRow[] }) {
  if (batches.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-slate-500">
        No sponsor imports yet. Start by creating an event edition, then upload an Excel file.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">File</th>
            <th className="px-4 py-3">Edition</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Rows</th>
            <th className="px-4 py-3">Created</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {batches.map((batch) => {
            const isActive = ["uploaded", "review", "draft"].includes(batch.status);
            const resumeStep = defaultStepForBatchStatus(
              batch.status as "uploaded" | "review" | "draft" | "published" | "discarded",
            );
            return (
              <tr key={batch.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-900">{batch.source_filename}</td>
                <td className="px-4 py-3 text-slate-700">
                  <div>{batch.edition_name}</div>
                  <div className="text-xs text-slate-500">
                    {batch.series_name ?? "—"} · {batch.edition_year}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <ImportBatchStatusBadge status={batch.status} />
                </td>
                <td className="px-4 py-3">{batch.source_row_count}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(batch.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {isActive ? (
                      <Link
                        href={flowHref(batch.id, resumeStep)}
                        className="text-brand-primary hover:underline"
                      >
                        Resume
                      </Link>
                    ) : (
                      <Link
                        href={`/admin/sponsor-imports/${batch.id}`}
                        className="text-brand-primary hover:underline"
                      >
                        View
                      </Link>
                    )}
                    {batch.status === "published" ? (
                      <a
                        href={`/api/admin/sponsor-imports/batches/${batch.id}/report`}
                        className="text-slate-600 hover:underline"
                      >
                        CSV
                      </a>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
