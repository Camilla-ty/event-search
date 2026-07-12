"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import type { ImportStep } from "../client/types";
import type { RowSummary, SponsorImportBatch } from "../client/types";
import { useSponsorImportWizardStep } from "../client/useSponsorImportWizardStep";
import { DiscardImportModal } from "./DiscardImportModal";
import { ImportContextBar } from "./ImportContextBar";
import { ImportFlowProgressProvider, useImportFlowProgress } from "./ImportFlowProgress";
import { ImportStepper } from "./ImportStepper";
import { SponsorImportWizardProvider } from "./SponsorImportWizardContext";
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

export function SponsorImportFlow(props: SponsorImportFlowProps) {
  return (
    <ImportFlowProgressProvider>
      <SponsorImportFlowBody {...props} />
    </ImportFlowProgressProvider>
  );
}

function SponsorImportFlowBody({
  batch: initialBatch,
  summary,
  edition,
  step: initialStep,
  spreadsheetHeaders,
}: SponsorImportFlowProps) {
  const router = useRouter();
  const { progressLabel } = useImportFlowProgress();
  const [discardOpen, setDiscardOpen] = useState(false);
  const [localBatch, setLocalBatch] = useState<SponsorImportBatch>(initialBatch);

  const { activeStep, goToStep } = useSponsorImportWizardStep({
    batchId: localBatch.id,
    initialStep,
    batchStatus: localBatch.status,
  });

  const updateBatch = useCallback((batch: SponsorImportBatch) => {
    setLocalBatch(batch);
  }, []);

  const markImportToDraftComplete = useCallback(() => {
    setLocalBatch((current) => ({
      ...current,
      status: "draft",
      processing_phase: null,
    }));
  }, []);

  const wizardContext = useMemo(
    () => ({
      batch: localBatch,
      goToStep,
      updateBatch,
      markImportToDraftComplete,
    }),
    [localBatch, goToStep, updateBatch, markImportToDraftComplete],
  );

  return (
    <SponsorImportWizardProvider value={wizardContext}>
      <div className="space-y-6">
        <ImportContextBar
          editionName={edition.name}
          seriesName={edition.seriesName}
          editionYear={edition.year}
          editionId={edition.id}
          filename={localBatch.source_filename}
          status={localBatch.status}
          rowCount={localBatch.source_row_count}
          progressLabel={progressLabel}
          onDiscard={() => setDiscardOpen(true)}
        />

        {edition.warnings.length > 0 ? (
          <ul className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {edition.warnings.map((w) => (
              <li key={w}>· {w}</li>
            ))}
          </ul>
        ) : null}

        <ImportStepper currentStep={activeStep} />

        {activeStep === "upload" ? <UploadStep /> : null}
        {activeStep === "mapping" ? (
          <ColumnMappingStep spreadsheetHeaders={spreadsheetHeaders} />
        ) : null}
        {activeStep === "validation" ? (
          <ValidationStep initialSummary={summary} />
        ) : null}
        {activeStep === "review" ? (
          <ReviewQueueStep initialSummary={summary} />
        ) : null}
        {activeStep === "draft" ? <DraftReviewStep /> : null}
        {activeStep === "publish" ? <PublishStep editionId={edition.id} /> : null}

        <DiscardImportModal
          batchId={localBatch.id}
          open={discardOpen}
          onClose={() => setDiscardOpen(false)}
          onDiscarded={() => router.push("/admin/sponsor-imports")}
        />
      </div>
    </SponsorImportWizardProvider>
  );
}
