"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import {
  ImportFlowProgressProvider,
  useImportFlowProgress,
} from "@/src/features/sponsor-import/components/ImportFlowProgress";

import type { ImportStep } from "../client/types";
import type {
  MatchMethodSummary,
  MaterializePreviewSummary,
  RowSummary,
} from "../types";
import type { ImportScope, PartnerAlumniImportBatch } from "../client/types";
import { usePartnerAlumniImportWizardStep } from "../client/usePartnerAlumniImportWizardStep";
import { DiscardImportModal } from "./DiscardImportModal";
import { ImportContextBar } from "./ImportContextBar";
import { ImportStepper } from "./ImportStepper";
import { PartnerAlumniImportWizardProvider } from "./PartnerAlumniImportWizardContext";
import { ColumnMappingStep } from "./steps/ColumnMappingStep";
import { ImportSummaryStep } from "./steps/ImportSummaryStep";
import { ReviewQueueStep } from "./steps/ReviewQueueStep";
import { UploadStep } from "./steps/UploadStep";
import { ValidationStep } from "./steps/ValidationStep";

type VersionContext = {
  seriesName: string;
  versionLabel: string;
  warnings: string[];
};

type PartnerAlumniImportFlowProps = {
  scope: ImportScope;
  batch: PartnerAlumniImportBatch;
  summary: RowSummary;
  matchMethodSummary: MatchMethodSummary;
  materializePreview: MaterializePreviewSummary;
  pendingCreateNewCount: number;
  version: VersionContext;
  step: ImportStep;
  spreadsheetHeaders: string[];
};

export function PartnerAlumniImportFlow(props: PartnerAlumniImportFlowProps) {
  return (
    <ImportFlowProgressProvider>
      <PartnerAlumniImportFlowBody {...props} />
    </ImportFlowProgressProvider>
  );
}

function PartnerAlumniImportFlowBody({
  scope,
  batch: initialBatch,
  summary,
  matchMethodSummary,
  materializePreview,
  pendingCreateNewCount,
  version,
  step: initialStep,
  spreadsheetHeaders,
}: PartnerAlumniImportFlowProps) {
  const router = useRouter();
  const { progressLabel } = useImportFlowProgress();
  const [discardOpen, setDiscardOpen] = useState(false);
  const [localBatch, setLocalBatch] = useState<PartnerAlumniImportBatch>(initialBatch);

  const { activeStep, goToStep } = usePartnerAlumniImportWizardStep({
    scope,
    batchId: localBatch.id,
    initialStep,
    batchStatus: localBatch.status,
  });

  const updateBatch = useCallback((batch: PartnerAlumniImportBatch) => {
    setLocalBatch(batch);
  }, []);

  const markValidationComplete = useCallback(() => {
    setLocalBatch((current) => ({
      ...current,
      status: "review",
      processing_phase: null,
    }));
  }, []);

  const markImportComplete = useCallback(() => {
    setLocalBatch((current) => ({
      ...current,
      status: "imported",
      processing_phase: null,
    }));
  }, []);

  const wizardContext = useMemo(
    () => ({
      scope,
      batch: localBatch,
      goToStep,
      updateBatch,
      markValidationComplete,
      markImportComplete,
    }),
    [scope, localBatch, goToStep, updateBatch, markValidationComplete, markImportComplete],
  );

  const exitHref = `/admin/events/series/${scope.seriesId}`;

  return (
    <PartnerAlumniImportWizardProvider value={wizardContext}>
      <div className="space-y-6">
        <ImportContextBar
          scope={scope}
          seriesName={version.seriesName}
          versionLabel={version.versionLabel}
          filename={localBatch.source_filename}
          status={localBatch.status}
          rowCount={localBatch.source_row_count}
          progressLabel={progressLabel}
          onDiscard={() => setDiscardOpen(true)}
        />

        {version.warnings.length > 0 ? (
          <ul className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {version.warnings.map((w) => (
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
          <ReviewQueueStep
            initialSummary={summary}
            initialMatchMethodSummary={matchMethodSummary}
            initialMaterializePreview={materializePreview}
            initialPendingCreateNewCount={pendingCreateNewCount}
          />
        ) : null}
        {activeStep === "summary" ? (
          <ImportSummaryStep
            seriesName={version.seriesName}
            versionLabel={version.versionLabel}
          />
        ) : null}

        <DiscardImportModal
          scope={scope}
          batchId={localBatch.id}
          open={discardOpen}
          onClose={() => setDiscardOpen(false)}
          onDiscarded={() => router.push(exitHref)}
        />
      </div>
    </PartnerAlumniImportWizardProvider>
  );
}
