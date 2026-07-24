"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/src/components/common";
import { primaryCtaClass, secondaryCtaClass } from "@/src/lib/design/classes";

import { applyEditionImportDiscard } from "../client/editionImportsPanelMutations";
import { defaultStepForBatchStatus, flowHref } from "../client/resumeStep";
import type { EditionImportContext } from "../server/importUiData";
import { DiscardImportModal } from "./DiscardImportModal";
import { ImportBatchStatusBadge } from "./ImportBatchStatusBadge";
import { ImportHistoryTable, type ImportHistoryRow } from "./ImportHistoryTable";

type EditionImportsPanelProps = {
  data: EditionImportContext;
};

export function EditionImportsPanel({ data: initialData }: EditionImportsPanelProps) {
  const [panelData, setPanelData] = useState(initialData);
  const [discardOpen, setDiscardOpen] = useState(false);

  useEffect(() => {
    setPanelData(initialData);
  }, [initialData]);

  const active = panelData.activeBatch;
  const activeId = active && typeof active.id === "string" ? active.id : null;
  const activeStatus = active && typeof active.status === "string" ? active.status : null;

  const tableRows: ImportHistoryRow[] = panelData.batches.map((b) => ({
    id: String(b.id),
    status: String(b.status),
    source_filename: String(b.source_filename),
    source_row_count: Number(b.source_row_count),
    created_at: String(b.created_at),
    edition_name: String(b.edition_name),
    edition_year: Number(b.edition_year),
    series_name: b.series_name != null ? String(b.series_name) : null,
    event_edition_id: String(b.event_edition_id),
  }));

  function handleDiscarded() {
    if (activeId === null) {
      return;
    }
    setPanelData((current) => applyEditionImportDiscard(current, activeId));
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <p>
          <span className="font-medium">{panelData.editionName}</span> · {panelData.seriesName}
        </p>
        <p className="mt-1 text-slate-600">Live sponsors: {panelData.liveSponsorCount}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        {activeId && activeStatus ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-900">Import in progress</span>
              <ImportBatchStatusBadge status={activeStatus} />
              {active && typeof active.source_filename === "string" ? (
                <span className="text-sm text-slate-600">{active.source_filename}</span>
              ) : null}
            </div>
            <p className="text-sm text-slate-600">
              One active import per event. Resume or discard before starting a new import.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={flowHref(
                  activeId,
                  defaultStepForBatchStatus(
                    activeStatus as "uploaded" | "review" | "draft" | "published" | "discarded",
                  ),
                )}
                className={`${primaryCtaClass} h-10`}
              >
                Resume import
              </Link>
              <Button variant="secondary" onClick={() => setDiscardOpen(true)}>
                Discard import
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">No import in progress.</p>
            <Link
              href={`/admin/sponsor-imports/new?editionId=${panelData.editionId}`}
              className={`${primaryCtaClass} h-10`}
            >
              Import sponsors
            </Link>
          </div>
        )}
      </div>

      <ImportHistoryTable batches={tableRows} />

      <Link
        href="/admin/sponsor-imports"
        className={`${secondaryCtaClass} inline-flex h-9 text-sm`}
      >
        View all sponsor imports
      </Link>

      {activeId ? (
        <DiscardImportModal
          batchId={activeId}
          open={discardOpen}
          onClose={() => setDiscardOpen(false)}
          onDiscarded={handleDiscarded}
        />
      ) : null}
    </div>
  );
}
