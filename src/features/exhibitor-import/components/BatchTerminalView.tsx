import Link from "next/link";

import { primaryCtaClass, secondaryCtaClass } from "@/src/lib/design/classes";

import { ImportBatchStatusBadge } from "./ImportBatchStatusBadge";

type BatchTerminalViewProps = {
  batchId: string;
  status: string;
  filename: string;
  editionId: string;
  editionName: string;
  rowCount: number;
  publishedAt?: string | null;
};

export function BatchTerminalView({
  batchId,
  status,
  filename,
  editionId,
  editionName,
  rowCount,
  publishedAt,
}: BatchTerminalViewProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-900">{filename}</h2>
          <ImportBatchStatusBadge status={status} />
        </div>
        <p className="mt-2 text-sm text-slate-600">
          {editionName} · {rowCount} rows
          {publishedAt ? ` · Published ${new Date(publishedAt).toLocaleDateString()}` : ""}
        </p>
      </div>

      {status === "published" ? (
        <p className="text-sm text-slate-600">
          This import has been published. Live exhibitors on the event reflect the publish
          result.
        </p>
      ) : (
        <p className="text-sm text-slate-600">This import was discarded and is no longer active.</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/admin/events/editions/${editionId}?tab=exhibitors`}
          className={`${primaryCtaClass} h-10`}
        >
          Back to exhibitors
        </Link>
        {status === "published" ? (
          <a
            href={`/api/admin/exhibitor-imports/batches/${batchId}/report`}
            className={`${secondaryCtaClass} h-10`}
          >
            Download CSV report
          </a>
        ) : null}
      </div>
    </div>
  );
}
