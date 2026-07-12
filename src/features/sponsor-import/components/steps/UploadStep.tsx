"use client";

import { useEffect } from "react";

import { useSponsorImportWizard } from "../SponsorImportWizardContext";
import { IMPORT_PROGRESS } from "../../importProgress";
import { ImportProgressMessage } from "../ImportProgressMessage";

export function UploadStep() {
  const { batch, goToStep } = useSponsorImportWizard();

  useEffect(() => {
    goToStep("mapping");
  }, [goToStep]);

  return (
    <div className="space-y-4">
      <ImportProgressMessage message={IMPORT_PROGRESS.openingMapping} />
      <p className="text-sm text-slate-600">
        File uploaded ({batch.source_filename}, {batch.source_row_count} rows). Continuing to column
        mapping…
      </p>
    </div>
  );
}
