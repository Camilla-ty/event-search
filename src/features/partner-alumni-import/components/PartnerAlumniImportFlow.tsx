"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ImportStep } from "../client/types";
import type {
  MatchMethodSummary,
  MaterializePreviewSummary,
  RowSummary,
} from "../types";
import type { ImportScope, PartnerAlumniImportBatch } from "../client/types";
import {
  ImportFlowProgressProvider,
  useImportFlowProgress,
} from "@/src/features/sponsor-import/components/ImportFlowProgress";
import { DiscardImportModal } from "./DiscardImportModal";
import { ImportContextBar } from "./ImportContextBar";
import { ImportStepper } from "./ImportStepper";
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
  batch,
  summary,
  matchMethodSummary,
  materializePreview,
  pendingCreateNewCount,
  version,
  step,
  spreadsheetHeaders,
}: PartnerAlumniImportFlowProps) {
  const router = useRouter();
  const { progressLabel } = useImportFlowProgress();
  const [discardOpen, setDiscardOpen] = useState(false);

  const exitHref = `/admin/events/series/${scope.seriesId}`;

  return (
    <div className="space-y-6">
      <ImportContextBar
        scope={scope}
        seriesName={version.seriesName}
        versionLabel={version.versionLabel}
        filename={batch.source_filename}
        status={batch.status}
        rowCount={batch.source_row_count}
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

      <ImportStepper currentStep={step} />

      {step === "upload" ? <UploadStep scope={scope} batch={batch} /> : null}
      {step === "mapping" ? (
        <ColumnMappingStep scope={scope} batch={batch} spreadsheetHeaders={spreadsheetHeaders} />
      ) : null}
      {step === "validation" ? (
        <ValidationStep scope={scope} batch={batch} initialSummary={summary} />
      ) : null}
      {step === "review" ? (
        <ReviewQueueStep
          scope={scope}
          batch={batch}
          initialSummary={summary}
          initialMatchMethodSummary={matchMethodSummary}
          initialMaterializePreview={materializePreview}
          initialPendingCreateNewCount={pendingCreateNewCount}
        />
      ) : null}
      {step === "summary" ? (
        <ImportSummaryStep
          scope={scope}
          batch={batch}
          seriesName={version.seriesName}
          versionLabel={version.versionLabel}
        />
      ) : null}

      <DiscardImportModal
        scope={scope}
        batchId={batch.id}
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        onDiscarded={() => router.push(exitHref)}
      />
    </div>
  );
}
