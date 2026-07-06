import Link from "next/link";

import { primaryCtaClass, secondaryCtaClass } from "@/src/lib/design/classes";

import { reportCsvUrl } from "../client/api";
import type { ImportScope } from "../client/types";
import { ImportBatchStatusBadge } from "./ImportBatchStatusBadge";

type BatchTerminalViewProps = {
  scope: ImportScope;
  batchId: string;
  status: string;
  filename: string;
  seriesName: string;
  versionLabel: string;
  rowCount: number;
  importedAt?: string | null;
};

export function BatchTerminalView({
  scope,
  batchId,
  status,
  filename,
  seriesName,
  versionLabel,
  rowCount,
  importedAt,
}: BatchTerminalViewProps) {
  const seriesHref = `/admin/events/series/${scope.seriesId}`;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-900">{filename}</h2>
          <ImportBatchStatusBadge status={status} />
        </div>
        <p className="mt-2 text-sm text-slate-600">
          {seriesName} · {versionLabel} · {rowCount} rows
          {importedAt ? ` · Imported ${new Date(importedAt).toLocaleDateString()}` : ""}
        </p>
      </div>

      {status === "imported" ? (
        <p className="text-sm text-slate-600">
          Version members were written. Download the outcome CSV to audit match methods and errors
          per row.
        </p>
      ) : (
        <p className="text-sm text-slate-600">This import was discarded.</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href={seriesHref} className={`${primaryCtaClass} h-10`}>
          Partner Alumni panel
        </Link>
        {status === "imported" ? (
          <a href={reportCsvUrl(scope, batchId)} className={`${secondaryCtaClass} h-10`}>
            Download CSV report
          </a>
        ) : null}
      </div>
    </div>
  );
}
