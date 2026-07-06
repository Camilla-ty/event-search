"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { InlineErrorBanner } from "@/src/components/common";
import { primaryCtaClass, secondaryCtaClass } from "@/src/lib/design/classes";
import { ImportProgressMessage } from "@/src/features/sponsor-import/components/ImportProgressMessage";
import { useImportProgressLabel } from "@/src/features/sponsor-import/components/ImportFlowProgress";

import { fetchImportSummary, reportCsvUrl } from "../../client/api";
import type { ImportCompletionSummary, ImportScope, PartnerAlumniImportBatch } from "../../client/types";
import { IMPORT_PROGRESS } from "../../importProgress";

type ImportSummaryStepProps = {
  scope: ImportScope;
  batch: PartnerAlumniImportBatch;
  seriesName: string;
  versionLabel: string;
};

export function ImportSummaryStep({
  scope,
  batch,
  seriesName,
  versionLabel,
}: ImportSummaryStepProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportCompletionSummary | null>(null);

  useImportProgressLabel(loading, IMPORT_PROGRESS.loadingSummary);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const result = await fetchImportSummary(scope, batch.id);
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
      } else {
        setSummary(result.summary);
      }
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [batch.id, scope]);

  const seriesHref = `/admin/events/series/${scope.seriesId}`;

  if (batch.status === "discarded") {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-700">
        This import was discarded. No version members were written.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Import complete</h2>
        <p className="mt-1 text-sm text-slate-600">
          {seriesName} · {versionLabel} — {batch.source_filename}
        </p>
      </div>

      {loading ? <ImportProgressMessage message={IMPORT_PROGRESS.loadingSummary} /> : null}
      {error ? <InlineErrorBanner message={error} /> : null}

      {summary ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <ul className="space-y-1 text-sm text-emerald-950">
            <li>Rows imported: {summary.rows_imported}</li>
            <li>Companies created: {summary.companies_created}</li>
            <li>Version members created: {summary.members_created}</li>
            <li>Version members updated: {summary.members_updated}</li>
            <li>Rows excluded: {summary.rows_excluded}</li>
          </ul>
          {summary.companies_created > 0 ? (
            <p className="mt-3 text-sm font-medium text-emerald-900">
              {summary.companies_created} new{" "}
              {summary.companies_created === 1 ? "company was" : "companies were"} added to the
              catalog during this import.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link href={seriesHref} className={`${primaryCtaClass} h-10`}>
          Back to Partner Alumni
        </Link>
        <a href={reportCsvUrl(scope, batch.id)} className={`${secondaryCtaClass} h-10`}>
          Download outcome CSV
        </a>
      </div>

      <p className="text-xs text-slate-500">
        Current public version was not changed automatically. Use Set as current on the series
        Partner Alumni panel when ready.
      </p>
    </div>
  );
}
