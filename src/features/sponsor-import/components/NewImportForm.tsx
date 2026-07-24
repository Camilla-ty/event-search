"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button, InlineErrorBanner } from "@/src/components/common";
import { formInputClass, secondaryCtaClass } from "@/src/lib/design/classes";

import { fetchActiveBatch, uploadBatch } from "../client/api";
import { flowHref } from "../client/resumeStep";
import { FileUploadBox } from "./FileUploadBox";

export type EditionOption = {
  id: string;
  name: string;
  year: number;
  seriesName: string | null;
};

type NewImportFormProps = {
  editions: EditionOption[];
  preselectedEditionId?: string;
};

function downloadTemplate() {
  const header = "Company name,Website,Sponsor tier\n";
  const sample = "Acme Corp,https://acme.com,1\n";
  const blob = new Blob([header + sample], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sponsor-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function NewImportForm({ editions, preselectedEditionId }: NewImportFormProps) {
  const router = useRouter();
  const [editionId, setEditionId] = useState(preselectedEditionId ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);

  useEffect(() => {
    if (!editionId) {
      setActiveBatchId(null);
      return;
    }
    let cancelled = false;
    async function check() {
      const result = await fetchActiveBatch(editionId);
      if (cancelled || !result.ok) return;
      setActiveBatchId(result.batch?.id ?? null);
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, [editionId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editionId || !file) {
      setError("Select an event and file.");
      return;
    }
    if (activeBatchId) {
      setError("This event already has an active import. Resume or discard it first.");
      return;
    }

    setLoading(true);
    setError(null);
    const form = new FormData();
    form.set("event_edition_id", editionId);
    form.set("file", file);
    const result = await uploadBatch(form);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(flowHref(result.batch.id, "mapping"));
  }

  const selectedEdition = editions.find((e) => e.id === editionId);

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-700">
        <p className="font-medium text-slate-900">Excel sponsor import</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>One active import per event</li>
          <li>Max 500 rows per file</li>
          <li>Columns: company name, website, sponsor tier (integer)</li>
        </ul>
        <button
          type="button"
          onClick={downloadTemplate}
          className="mt-3 cursor-pointer text-brand-primary hover:underline"
        >
          Download CSV template
        </button>
      </div>

      <label className="block text-sm font-medium text-slate-700">
        Event
        <select
          className={formInputClass}
          value={editionId}
          onChange={(e) => setEditionId(e.target.value)}
          disabled={Boolean(preselectedEditionId)}
        >
          <option value="">Select event…</option>
          {editions.map((ed) => (
            <option key={ed.id} value={ed.id}>
              {ed.seriesName ? `${ed.seriesName} · ` : ""}
              {ed.name} ({ed.year})
            </option>
          ))}
        </select>
      </label>

      {selectedEdition && activeBatchId ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p>This event has an import in progress.</p>
          <Link
            href={flowHref(activeBatchId, "review")}
            className="mt-2 inline-block font-medium text-brand-primary hover:underline"
          >
            Resume import →
          </Link>
        </div>
      ) : null}

      <FileUploadBox
        file={file}
        onFileChange={setFile}
        disabled={loading || Boolean(activeBatchId)}
      />

      {error ? <InlineErrorBanner message={error} /> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={loading || Boolean(activeBatchId) || !file}>
          {loading ? "Uploading file…" : "Upload & continue"}
        </Button>
        <Link href="/admin/sponsor-imports" className={`${secondaryCtaClass} h-10`}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
