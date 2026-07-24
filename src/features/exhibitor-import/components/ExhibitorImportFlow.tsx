"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { shouldRedirectReviewToDraft } from "../client/importDraftNavigation";
import { flowHref } from "../client/resumeStep";

import type { ImportStep } from "../client/types";
import type { RowSummary, ExhibitorImportBatch } from "../client/types";
import { useExhibitorImportWizardStep } from "../client/useExhibitorImportWizardStep";
import { DiscardImportModal } from "./DiscardImportModal";
import { ImportContextBar } from "./ImportContextBar";
import { ImportFlowProgressProvider, useImportFlowProgress } from "./ImportFlowProgress";
import { ImportStepper } from "./ImportStepper";
import { ExhibitorImportWizardProvider } from "./ExhibitorImportWizardContext";
import { ColumnMappingStep } from "./steps/ColumnMappingStep";
import { DraftReviewStep } from "./steps/DraftReviewStep";
import { PublishStep } from "./steps/PublishStep";
import { ReviewQueueStep } from "./steps/ReviewQueueStep";
import { UploadStep } from "./steps/UploadStep";
import { ValidationStep } from "./steps/ValidationStep";

function OpenDraftFallback({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-6 text-center">
      <p className="text-sm font-medium text-emerald-950">This import already has a draft.</p>
      <button
        type="button"
        onClick={onOpen}
        className="mt-3 text-sm font-semibold text-brand-primary hover:underline"
      >
        Open draft →
      </button>
    </div>
  );
}

type EditionContext = {
  id: string;
  name: string;
  year: number;
  seriesName: string | null;
  warnings: string[];
};

type ExhibitorImportFlowProps = {
  batch: ExhibitorImportBatch;
  summary: RowSummary;
  edition: EditionContext;
  step: ImportStep;
  spreadsheetHeaders: string[];
};

export function ExhibitorImportFlow(props: ExhibitorImportFlowProps) {
  return (
    <ImportFlowProgressProvider>
      <ExhibitorImportFlowBody {...props} />
    </ImportFlowProgressProvider>
  );
}

function ExhibitorImportFlowBody({
  batch: initialBatch,
  summary,
  edition,
  step: initialStep,
  spreadsheetHeaders,
}: ExhibitorImportFlowProps) {
  const router = useRouter();
  const { progressLabel } = useImportFlowProgress();
  const [discardOpen, setDiscardOpen] = useState(false);
  const [localBatch, setLocalBatch] = useState<ExhibitorImportBatch>(initialBatch);

  const { activeStep, goToStep } = useExhibitorImportWizardStep({
    batchId: localBatch.id,
    initialStep,
    batchStatus: localBatch.status,
  });

  const updateBatch = useCallback((batch: ExhibitorImportBatch) => {
    setLocalBatch(batch);
  }, []);

  const markImportToDraftComplete = useCallback(() => {
    setLocalBatch((current) => ({
      ...current,
      status: "draft",
      processing_phase: null,
    }));
  }, []);

  const openDraftStep = useCallback(() => {
    markImportToDraftComplete();
    router.replace(flowHref(localBatch.id, "draft"));
  }, [localBatch.id, markImportToDraftComplete, router]);

  useEffect(() => {
    if (shouldRedirectReviewToDraft(localBatch.status, activeStep)) {
      router.replace(flowHref(localBatch.id, "draft"));
    }
  }, [activeStep, localBatch.id, localBatch.status, router]);

  const wizardContext = useMemo(
    () => ({
      batch: localBatch,
      goToStep,
      openDraftStep,
      updateBatch,
      markImportToDraftComplete,
    }),
    [localBatch, goToStep, openDraftStep, updateBatch, markImportToDraftComplete],
  );

  return (
    <ExhibitorImportWizardProvider value={wizardContext}>
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
        {activeStep === "review" && localBatch.status !== "draft" ? (
          <ReviewQueueStep initialSummary={summary} />
        ) : null}
        {activeStep === "review" && localBatch.status === "draft" ? (
          <OpenDraftFallback onOpen={openDraftStep} />
        ) : null}
        {activeStep === "draft" ? <DraftReviewStep /> : null}
        {activeStep === "publish" ? <PublishStep editionId={edition.id} /> : null}

        <DiscardImportModal
          batchId={localBatch.id}
          open={discardOpen}
          onClose={() => setDiscardOpen(false)}
          onDiscarded={() =>
            router.push(`/admin/events/editions/${edition.id}?tab=exhibitors`)
          }
        />
      </div>
    </ExhibitorImportWizardProvider>
  );
}
