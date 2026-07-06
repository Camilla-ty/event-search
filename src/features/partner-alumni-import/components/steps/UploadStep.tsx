"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { flowHref } from "../../client/resumeStep";
import type { ImportScope, PartnerAlumniImportBatch } from "../../client/types";
import { IMPORT_PROGRESS } from "../../importProgress";
import { ImportProgressMessage } from "@/src/features/sponsor-import/components/ImportProgressMessage";

type UploadStepProps = {
  scope: ImportScope;
  batch: PartnerAlumniImportBatch;
};

export function UploadStep({ scope, batch }: UploadStepProps) {
  const router = useRouter();

  useEffect(() => {
    router.replace(flowHref(scope, batch.id, "mapping"));
  }, [batch.id, router, scope]);

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
