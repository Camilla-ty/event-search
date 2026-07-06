"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, InlineErrorBanner } from "@/src/components/common";
import { formInputClass, primaryCtaClass } from "@/src/lib/design/classes";

import { fetchActiveBatch, uploadBatch } from "../client/api";
import { flowHref, importNewPath } from "../client/resumeStep";
import type { ImportScope } from "../client/types";

type NewImportFormProps = {
  scope: ImportScope;
  versionLabel: string;
  activeBatchId?: string | null;
};

export function NewImportForm({ scope, versionLabel, activeBatchId }: NewImportFormProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choose a spreadsheet file.");
      return;
    }

    setLoading(true);
    setError(null);

    const active = await fetchActiveBatch(scope);
    if (active.ok && active.batch) {
      setLoading(false);
      setError(
        "An active import already exists for this version. Resume or discard it before starting a new upload.",
      );
      return;
    }

    const form = new FormData();
    form.set("file", file);
    const result = await uploadBatch(scope, form);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.push(flowHref(scope, result.batch.id, "mapping"));
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="max-w-xl space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <p className="font-medium text-slate-900">Target version: {versionLabel}</p>
        <p className="mt-1">
          Upload an Excel or CSV file (.xlsx, .xls, .csv). Maximum 500 rows. Column mapping is
          required before validation.
        </p>
      </div>

      {activeBatchId ? (
        <p className="text-sm text-amber-800">
          You have an in-progress import.{" "}
          <Link
            href={flowHref(scope, activeBatchId, "review")}
            className="text-brand-primary hover:underline"
          >
            Resume import
          </Link>
        </p>
      ) : null}

      <div>
        <label htmlFor="pa-import-file" className="mb-1 block text-sm font-medium text-slate-700">
          Spreadsheet file *
        </label>
        <input
          id="pa-import-file"
          type="file"
          accept=".xlsx,.xls,.csv"
          className={formInputClass}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {error ? <InlineErrorBanner message={error} /> : null}

      <Button type="submit" disabled={loading || !file}>
        {loading ? "Uploading…" : "Upload and map columns"}
      </Button>
    </form>
  );
}

export { importNewPath };
