"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, InlineErrorBanner } from "@/src/components/common";

import { fetchRows, runMatching, runValidation, saveColumnMapping } from "../../client/api";
import { flowHref } from "../../client/resumeStep";
import type { RowSummary, SponsorImportBatch, SponsorImportRow } from "../../client/types";

type ValidationStepProps = {
  batch: SponsorImportBatch;
  initialSummary: RowSummary;
};

export function ValidationStep({ batch, initialSummary }: ValidationStepProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [continuing, setContinuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<RowSummary>(initialSummary);
  const [rows, setRows] = useState<SponsorImportRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      const val = await runValidation(batch.id);
      if (cancelled) return;
      if (!val.ok) {
        setError(val.error);
        setLoading(false);
        return;
      }
      const listed = await fetchRows(batch.id, { page: 1, pageSize: 50 });
      if (cancelled) return;
      if (!listed.ok) {
        setError(listed.error);
        setLoading(false);
        return;
      }
      setSummary(listed.summary);
      setRows(listed.rows);
      setLoading(false);
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [batch.id]);

  const canContinue = summary.blocking_validation_count === 0;

  async function handleContinue() {
    setContinuing(true);
    setError(null);

    if (batch.status === "uploaded") {
      const mapped = await saveColumnMapping(batch.id, batch.column_mapping, true);
      if (!mapped.ok) {
        setError(mapped.error);
        setContinuing(false);
        return;
      }
    }

    const matched = await runMatching(batch.id);
    if (!matched.ok) {
      setError(matched.error);
      setContinuing(false);
      return;
    }

    router.push(flowHref(batch.id, "review"));
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Validation</h2>
        <p className="mt-1 text-sm text-slate-600">
          Checking required fields, tiers, and duplicate rows in the file.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Validating rows…</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="rounded-md bg-slate-100 px-3 py-1">
              Total: {summary.total}
            </span>
            <span className="rounded-md bg-rose-50 px-3 py-1 text-rose-900">
              Blocking: {summary.blocking_validation_count}
            </span>
            <span className="rounded-md bg-amber-50 px-3 py-1 text-amber-950">
              Pending duplicates: {summary.pending_duplicate_count}
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Row</th>
                  <th className="px-4 py-2">Company</th>
                  <th className="px-4 py-2">Domain</th>
                  <th className="px-4 py-2">Tier</th>
                  <th className="px-4 py-2">Issues</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-4 py-2">{row.excel_row_number}</td>
                    <td className="px-4 py-2">{row.raw_company_name ?? "—"}</td>
                    <td className="px-4 py-2">{row.normalized_domain ?? "—"}</td>
                    <td className="px-4 py-2">{row.mapped_tier_rank ?? "—"}</td>
                    <td className="px-4 py-2 text-xs text-slate-600">
                      {row.has_blocking_validation
                        ? row.validation_issues
                            .filter((i) => i.severity === "blocking")
                            .map((i) => i.message)
                            .join("; ")
                        : row.duplicate_role === "duplicate"
                          ? "Duplicate in file"
                          : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {error ? <InlineErrorBanner message={error} /> : null}

      <div className="flex gap-2">
        <Button
          variant="secondary"
          onClick={() => router.push(flowHref(batch.id, "mapping"))}
          disabled={loading}
        >
          Back
        </Button>
        <Button onClick={() => void handleContinue()} disabled={loading || continuing || !canContinue}>
          {continuing ? "Preparing review…" : "Continue to review →"}
        </Button>
      </div>
      {!canContinue && !loading ? (
        <p className="text-sm text-amber-800">
          Fix blocking validation errors in the source file and re-upload, or adjust column
          mapping.
        </p>
      ) : null}
    </div>
  );
}
