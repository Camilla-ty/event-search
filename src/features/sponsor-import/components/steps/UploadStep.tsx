"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/src/components/common";

import { flowHref } from "../../client/resumeStep";
import type { SponsorImportBatch } from "../../client/types";

type UploadStepProps = {
  batch: SponsorImportBatch;
};

export function UploadStep({ batch }: UploadStepProps) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Upload</h2>
        <p className="mt-1 text-sm text-slate-600">
          File uploaded successfully. Confirm column mapping next.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">File</dt>
            <dd className="font-medium text-slate-900">{batch.source_filename}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Rows</dt>
            <dd className="font-medium text-slate-900">{batch.source_row_count}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Format</dt>
            <dd className="font-medium text-slate-900">{batch.source_file_format}</dd>
          </div>
          {batch.source_sheet_name ? (
            <div>
              <dt className="text-slate-500">Sheet</dt>
              <dd className="font-medium text-slate-900">{batch.source_sheet_name}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      <Button onClick={() => router.push(flowHref(batch.id, "mapping"))}>
        Continue to column mapping →
      </Button>
    </div>
  );
}
