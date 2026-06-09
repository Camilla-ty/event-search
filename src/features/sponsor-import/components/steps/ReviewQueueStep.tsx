"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, InlineErrorBanner } from "@/src/components/common";

import {
  bulkAcceptDomains,
  bulkApplyRowDecisions,
  fetchRows,
  importToDraft,
  runMatching,
} from "../../client/api";
import { flowHref } from "../../client/resumeStep";
import type { RowSummary, SponsorImportBatch, SponsorImportRow } from "../../client/types";
import { SPONSOR_IMPORT_MAX_ROWS } from "../../types";
import {
  isEligibleForBulkCreateNew,
  isEligibleForBulkExclude,
  isSelectableReviewRow,
} from "../../reviewQueueEligibility";
import { BulkReviewConfirmModal } from "../BulkReviewConfirmModal";
import { RowDecisionDrawer } from "../RowDecisionDrawer";

type ReviewQueueStepProps = {
  batch: SponsorImportBatch;
  initialSummary: RowSummary;
};

type FilterKey = "needs_review" | "auto_ready" | "all";

type PendingBulkAction = "create_new" | "exclude";

function filterStatusParam(filter: FilterKey): string | undefined {
  if (filter === "needs_review") return "needs_review";
  if (filter === "auto_ready") return "auto_ready";
  return undefined;
}

export function ReviewQueueStep({ batch, initialSummary }: ReviewQueueStepProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<RowSummary>(initialSummary);
  const [rows, setRows] = useState<SponsorImportRow[]>([]);
  const [filter, setFilter] = useState<FilterKey>("needs_review");
  const [selectedRow, setSelectedRow] = useState<SponsorImportRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingBulk, setPendingBulk] = useState<PendingBulkAction | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const listed = await fetchRows(batch.id, {
      status: filterStatusParam(filter),
      page: 1,
      pageSize: SPONSOR_IMPORT_MAX_ROWS,
    });
    if (!listed.ok) {
      setError(listed.error);
      return;
    }
    setSummary(listed.summary);
    setRows(listed.rows);
    setSelectedIds((prev) => {
      const visible = new Set(listed.rows.map((r) => r.id));
      return new Set(Array.from(prev).filter((id) => visible.has(id)));
    });
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

  const visibleSelectableIds = useMemo(
    () => rows.filter(isSelectableReviewRow).map((r) => r.id),
    [rows],
  );

  const selectedRows = useMemo(
    () => rows.filter((r) => selectedIds.has(r.id)),
    [rows, selectedIds],
  );

  const createNewSelectedCount = useMemo(
    () => selectedRows.filter(isEligibleForBulkCreateNew).length,
    [selectedRows],
  );

  const excludeSelectedCount = useMemo(
    () => selectedRows.filter(isEligibleForBulkExclude).length,
    [selectedRows],
  );

  const allVisibleSelected =
    visibleSelectableIds.length > 0 &&
    visibleSelectableIds.every((id) => selectedIds.has(id));

  const canBulkAccept = summary.auto_ready > 0;
  const canImportToDraft =
    summary.auto_ready === 0 &&
    summary.needs_review === 0 &&
    summary.pending_duplicate_count === 0 &&
    summary.blocking_validation_count === 0;

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectIds(ids: string[]) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of visibleSelectableIds) next.delete(id);
        return next;
      });
      return;
    }
    selectIds(visibleSelectableIds);
  }

  async function selectAllMatchingFilter() {
    setActionLoading(true);
    setError(null);
    const listed = await fetchRows(batch.id, {
      status: filterStatusParam(filter),
      page: 1,
      pageSize: SPONSOR_IMPORT_MAX_ROWS,
    });
    setActionLoading(false);
    if (!listed.ok) {
      setError(listed.error);
      return;
    }
    const ids = listed.rows.filter(isSelectableReviewRow).map((r) => r.id);
    selectIds(ids);
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

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

  async function applyBulkAction(action: PendingBulkAction) {
    const targetIds =
      action === "create_new"
        ? selectedRows.filter(isEligibleForBulkCreateNew).map((r) => r.id)
        : selectedRows.filter(isEligibleForBulkExclude).map((r) => r.id);

    if (targetIds.length === 0) return;

    setActionLoading(true);
    setBulkError(null);
    const result = await bulkApplyRowDecisions(batch.id, {
      decision_type: action,
      row_ids: targetIds,
    });
    setActionLoading(false);

    if (!result.ok) {
      setBulkError(result.error);
      return;
    }

    setPendingBulk(null);
    setBulkError(null);
    clearSelection();
    await reload();
  }

  const pendingBulkCount =
    pendingBulk === "create_new" ? createNewSelectedCount : excludeSelectedCount;

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
            onClick={() => {
              setFilter(key);
              clearSelection();
            }}
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

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={loading || actionLoading || visibleSelectableIds.length === 0}
          onClick={toggleSelectAllVisible}
        >
          {allVisibleSelected ? "Deselect visible" : "Select all visible"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={loading || actionLoading}
          onClick={() => void selectAllMatchingFilter()}
        >
          Select all matching filter
        </Button>
        {selectedIds.size > 0 ? (
          <Button type="button" variant="secondary" size="sm" onClick={clearSelection}>
            Clear selection ({selectedIds.size})
          </Button>
        ) : null}
        <span className="text-slate-500">
          {selectedIds.size > 0
            ? `${selectedIds.size} selected · ${createNewSelectedCount} eligible for create-new`
            : "Select rows for bulk actions"}
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading rows…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    disabled={visibleSelectableIds.length === 0}
                    onChange={toggleSelectAllVisible}
                    aria-label="Select all visible rows"
                  />
                </th>
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
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    No rows in this filter.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const selectable = isSelectableReviewRow(row);
                  const canCreateNew = isEligibleForBulkCreateNew(row);
                  return (
                    <tr key={row.id} className="border-b border-slate-100">
                      <td className="px-4 py-2">
                        {selectable ? (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(row.id)}
                            onChange={() => toggleRow(row.id)}
                            aria-label={`Select row ${row.excel_row_number}`}
                          />
                        ) : null}
                      </td>
                      <td className="px-4 py-2">{row.excel_row_number}</td>
                      <td className="px-4 py-2">{row.raw_company_name ?? "—"}</td>
                      <td className="px-4 py-2">{row.normalized_domain ?? "—"}</td>
                      <td className="px-4 py-2">{row.mapped_tier_rank ?? "—"}</td>
                      <td className="px-4 py-2">
                        <span>{row.status}</span>
                        {selectable && !canCreateNew ? (
                          <span className="ml-2 text-xs text-slate-500">(exclude only)</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2">
                        {row.status === "needs_review" || row.duplicate_role === "duplicate" ? (
                          <Button size="sm" variant="secondary" onClick={() => setSelectedRow(row)}>
                            Decide
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
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
        <Button
          variant="secondary"
          disabled={createNewSelectedCount === 0 || actionLoading || loading}
          onClick={() => {
            setBulkError(null);
            setPendingBulk("create_new");
          }}
        >
          Create new companies ({createNewSelectedCount})
        </Button>
        <Button
          variant="secondary"
          disabled={excludeSelectedCount === 0 || actionLoading || loading}
          onClick={() => {
            setBulkError(null);
            setPendingBulk("exclude");
          }}
        >
          Exclude selected ({excludeSelectedCount})
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

      <BulkReviewConfirmModal
        open={pendingBulk !== null}
        action={pendingBulk ?? "create_new"}
        count={pendingBulkCount}
        loading={actionLoading}
        error={bulkError}
        onClose={() => {
          if (!actionLoading) {
            setPendingBulk(null);
            setBulkError(null);
          }
        }}
        onConfirm={() => {
          if (pendingBulk) void applyBulkAction(pendingBulk);
        }}
      />
    </div>
  );
}
