"use client";

import { useEffect, useState } from "react";

import { Button, InlineErrorBanner } from "@/src/components/common";
import { ImportProgressMessage } from "@/src/features/sponsor-import/components/ImportProgressMessage";
import { useImportProgressLabel } from "@/src/features/sponsor-import/components/ImportFlowProgress";

import { fetchRows, runValidation } from "../../client/api";
import type { PartnerAlumniImportRow, RowSummary } from "../../client/types";
import { IMPORT_PROGRESS } from "../../importProgress";
import { usePartnerAlumniImportWizard } from "../PartnerAlumniImportWizardContext";

type ValidationStepProps = {
  initialSummary: RowSummary;
};

export function ValidationStep({ initialSummary }: ValidationStepProps) {
  const { scope, batch, goToStep, markValidationComplete } = usePartnerAlumniImportWizard();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<RowSummary>(initialSummary);
  const [rows, setRows] = useState<PartnerAlumniImportRow[]>([]);

  useImportProgressLabel(loading, IMPORT_PROGRESS.validating);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      const val = await runValidation(scope, batch.id);
      if (cancelled) return;
      if (!val.ok) {
        setError(val.error);
        setLoading(false);
        return;
      }
      markValidationComplete();
      const listed = await fetchRows(scope, batch.id, { page: 1, pageSize: 50 });
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
  }, [batch.id, scope, markValidationComplete]);

  const canContinue = summary.blocking_validation_count === 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Validation</h2>
        <p className="mt-1 text-sm text-slate-600">
          Checking for duplicate rows, missing company names, and invalid websites using the same
          identity rules as sponsor import.
        </p>
      </div>

      {loading ? (
        <ImportProgressMessage message={IMPORT_PROGRESS.validating} />
      ) : (
        <>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="rounded-md bg-slate-100 px-3 py-1">Total: {summary.total}</span>
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
                  <th className="px-4 py-2">Order</th>
                  <th className="px-4 py-2">Issues</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-4 py-2">{row.excel_row_number}</td>
                    <td className="px-4 py-2">{row.raw_company_name ?? "—"}</td>
                    <td className="px-4 py-2">{row.normalized_domain ?? "—"}</td>
                    <td className="px-4 py-2">{row.mapped_display_order ?? "—"}</td>
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
          onClick={() => goToStep("mapping")}
          disabled={loading}
        >
          Back
        </Button>
        <Button
          onClick={() => goToStep("review")}
          disabled={loading || !canContinue}
        >
          Continue to review →
        </Button>
      </div>
      {!canContinue && !loading ? (
        <p className="text-sm text-amber-800">
          Fix blocking validation errors in the source file and re-upload, or adjust column mapping.
        </p>
      ) : null}
    </div>
  );
}
