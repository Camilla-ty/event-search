"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, InlineErrorBanner } from "@/src/components/common";

import {
  bulkAcceptDomains,
  fetchRows,
  importToDraft,
  runMatching,
} from "../../client/api";
import { flowHref } from "../../client/resumeStep";
import type { RowSummary, SponsorImportBatch, SponsorImportRow } from "../../client/types";
import { RowDecisionDrawer } from "../RowDecisionDrawer";

type ReviewQueueStepProps = {
  batch: SponsorImportBatch;
  initialSummary: RowSummary;
};

type FilterKey = "needs_review" | "auto_ready" | "all";

export function ReviewQueueStep({ batch, initialSummary }: ReviewQueueStepProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<RowSummary>(initialSummary);
  const [rows, setRows] = useState<SponsorImportRow[]>([]);
  const [filter, setFilter] = useState<FilterKey>("needs_review");
  const [selectedRow, setSelectedRow] = useState<SponsorImportRow | null>(null);

  const reload = useCallback(async () => {
    const status =
      filter === "needs_review" ? "needs_review" : filter === "auto_ready" ? "auto_ready" : undefined;
    const listed = await fetchRows(batch.id, { status, page: 1, pageSize: 100 });
    if (!listed.ok) {
      setError(listed.error);
      return;
    }
    setSummary(listed.summary);
    setRows(listed.rows);
  }, [batch.id, filter]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      setError(null);
      const matched = await runMatching(batch.id);
      if (cancelled) return;
      if (!matched.ok) {
        setError(matched.error);
        setLoading(false);
        return;
      }
      await reload();
      if (!cancelled) setLoading(false);
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [batch.id, reload]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const canBulkAccept = summary.auto_ready > 0;
  const canImportToDraft =
    summary.auto_ready === 0 &&
    summary.needs_review === 0 &&
    summary.pending_duplicate_count === 0 &&
    summary.blocking_validation_count === 0;

  async function handleBulkAccept() {
    setActionLoading(true);
    setError(null);
    const result = await bulkAcceptDomains(batch.id);
    setActionLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await reload();
  }

  async function handleImportToDraft() {
    setActionLoading(true);
    setError(null);
    const result = await importToDraft(batch.id);
    setActionLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(flowHref(batch.id, "draft"));
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Review queue</h2>
        <p className="mt-1 text-sm text-slate-600">
          Resolve company matches and duplicates before importing to draft.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded-md bg-slate-100 px-3 py-1">Total: {summary.total}</span>
        <span className="rounded-md bg-amber-50 px-3 py-1 text-amber-950">
          Needs review: {summary.needs_review}
        </span>
        <span className="rounded-md bg-sky-50 px-3 py-1 text-sky-950">
          Auto-ready: {summary.auto_ready}
        </span>
        <span className="rounded-md bg-emerald-50 px-3 py-1 text-emerald-950">
          Resolved: {summary.resolved}
        </span>
        <span className="rounded-md bg-slate-100 px-3 py-1">Excluded: {summary.excluded}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["needs_review", "auto_ready", "all"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={[
              "rounded-md px-3 py-1.5 text-sm",
              filter === key
                ? "bg-brand-primary-muted font-medium text-brand-primary"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200",
            ].join(" ")}
          >
            {key === "needs_review" ? "Needs review" : key === "auto_ready" ? "Auto-ready" : "All"}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading rows…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Row</th>
                <th className="px-4 py-2">Company</th>
                <th className="px-4 py-2">Domain</th>
                <th className="px-4 py-2">Tier</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    No rows in this filter.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-4 py-2">{row.excel_row_number}</td>
                    <td className="px-4 py-2">{row.raw_company_name ?? "—"}</td>
                    <td className="px-4 py-2">{row.normalized_domain ?? "—"}</td>
                    <td className="px-4 py-2">{row.mapped_tier_rank ?? "—"}</td>
                    <td className="px-4 py-2">{row.status}</td>
                    <td className="px-4 py-2">
                      {row.status === "needs_review" || row.duplicate_role === "duplicate" ? (
                        <Button size="sm" variant="secondary" onClick={() => setSelectedRow(row)}>
                          Decide
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {error ? <InlineErrorBanner message={error} /> : null}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => router.push(flowHref(batch.id, "validation"))}
          disabled={actionLoading}
        >
          Back
        </Button>
        {canBulkAccept ? (
          <Button onClick={() => void handleBulkAccept()} disabled={actionLoading || loading}>
            {actionLoading ? "Accepting…" : `Bulk accept domain matches (${summary.auto_ready})`}
          </Button>
        ) : null}
        <Button
          onClick={() => void handleImportToDraft()}
          disabled={!canImportToDraft || actionLoading || loading}
        >
          Import to draft →
        </Button>
      </div>

      {summary.auto_ready > 0 ? (
        <p className="text-sm text-amber-800">
          Bulk accept all auto-ready domain matches before importing to draft.
        </p>
      ) : null}

      <RowDecisionDrawer
        batchId={batch.id}
        row={selectedRow}
        onClose={() => setSelectedRow(null)}
        onUpdated={() => void reload()}
      />
    </div>
  );
}
