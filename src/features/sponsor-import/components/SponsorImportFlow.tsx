"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ImportStep } from "../client/types";
import type { RowSummary, SponsorImportBatch } from "../client/types";
import { DiscardImportModal } from "./DiscardImportModal";
import { ImportContextBar } from "./ImportContextBar";
import { ImportStepper } from "./ImportStepper";
import { ColumnMappingStep } from "./steps/ColumnMappingStep";
import { DraftReviewStep } from "./steps/DraftReviewStep";
import { PublishStep } from "./steps/PublishStep";
import { ReviewQueueStep } from "./steps/ReviewQueueStep";
import { UploadStep } from "./steps/UploadStep";
import { ValidationStep } from "./steps/ValidationStep";

type EditionContext = {
  id: string;
  name: string;
  year: number;
  seriesName: string | null;
  warnings: string[];
};

type SponsorImportFlowProps = {
  batch: SponsorImportBatch;
  summary: RowSummary;
  edition: EditionContext;
  step: ImportStep;
  spreadsheetHeaders: string[];
};

export function SponsorImportFlow({
  batch,
  summary,
  edition,
  step,
  spreadsheetHeaders,
}: SponsorImportFlowProps) {
  const router = useRouter();
  const [discardOpen, setDiscardOpen] = useState(false);

  return (
    <div className="space-y-6">
      <ImportContextBar
        editionName={edition.name}
        seriesName={edition.seriesName}
        editionYear={edition.year}
        editionId={edition.id}
        filename={batch.source_filename}
        status={batch.status}
        rowCount={batch.source_row_count}
        onDiscard={() => setDiscardOpen(true)}
      />

      {edition.warnings.length > 0 ? (
        <ul className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {edition.warnings.map((w) => (
            <li key={w}>· {w}</li>
          ))}
        </ul>
      ) : null}

      <ImportStepper currentStep={step} />

      {step === "upload" ? <UploadStep batch={batch} /> : null}
      {step === "mapping" ? (
        <ColumnMappingStep batch={batch} spreadsheetHeaders={spreadsheetHeaders} />
      ) : null}
      {step === "validation" ? (
        <ValidationStep batch={batch} initialSummary={summary} />
      ) : null}
      {step === "review" ? (
        <ReviewQueueStep batch={batch} initialSummary={summary} />
      ) : null}
      {step === "draft" ? <DraftReviewStep batch={batch} /> : null}
      {step === "publish" ? <PublishStep batch={batch} editionId={edition.id} /> : null}

      <DiscardImportModal
        batchId={batch.id}
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        onDiscarded={() => router.push("/admin/sponsor-imports")}
      />
    </div>
  );
}
