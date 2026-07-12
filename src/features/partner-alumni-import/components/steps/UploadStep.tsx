"use client";

import { useEffect } from "react";

import { usePartnerAlumniImportWizard } from "../PartnerAlumniImportWizardContext";
import { IMPORT_PROGRESS } from "../../importProgress";
import { ImportProgressMessage } from "@/src/features/sponsor-import/components/ImportProgressMessage";

export function UploadStep() {
  const { batch, goToStep } = usePartnerAlumniImportWizard();

  useEffect(() => {
    goToStep("mapping", { history: "replace" });
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
