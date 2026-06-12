"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, InlineErrorBanner } from "@/src/components/common";
import { importFilterChipClass } from "@/src/lib/design/classes";

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
import { IMPORT_PROGRESS } from "../../importProgress";
import {
  getBulkCreateNewButtonState,
  isEligibleForBulkCreateNew,
  isEligibleForBulkExclude,
  isSelectableReviewRow,
  resolveRowDomain,
} from "../../reviewQueueEligibility";
import { BulkReviewConfirmModal } from "../BulkReviewConfirmModal";
import { useImportProgressLabel } from "../ImportFlowProgress";
import { ImportProgressMessage } from "../ImportProgressMessage";
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
  const [progressMessage, setProgressMessage] = useState<string | null>(IMPORT_PROGRESS.matching);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<RowSummary>(initialSummary);
  const [rows, setRows] = useState<SponsorImportRow[]>([]);
  const [filter, setFilter] = useState<FilterKey>("needs_review");
  const [selectedRow, setSelectedRow] = useState<SponsorImportRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingBulk, setPendingBulk] = useState<PendingBulkAction | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const skipFilterReload = useRef(true);

  useImportProgressLabel(Boolean(progressMessage), progressMessage);

  const loadRowsForFilter = useCallback(
    async (activeFilter: FilterKey) => {
      const listed = await fetchRows(batch.id, {
        status: filterStatusParam(activeFilter),
        page: 1,
        pageSize: SPONSOR_IMPORT_MAX_ROWS,
      });
      if (!listed.ok) {
        setError(listed.error);
        return false;
      }
      setSummary(listed.summary);
      setRows(listed.rows);
      setSelectedIds((prev) => {
        const visible = new Set(listed.rows.map((r) => r.id));
        return new Set(Array.from(prev).filter((id) => visible.has(id)));
      });
      return true;
    },
    [batch.id],
  );

  const reload = useCallback(async () => {
    await loadRowsForFilter(filter);
  }, [filter, loadRowsForFilter]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);
      setProgressMessage(IMPORT_PROGRESS.matching);
      setError(null);
      skipFilterReload.current = true;

      const matched = await runMatching(batch.id);
      if (cancelled) return;
      if (!matched.ok) {
        setError(matched.error);
        setLoading(false);
        setProgressMessage(null);
        return;
      }

      await loadRowsForFilter(filter);
      if (cancelled) return;

      setLoading(false);
      setProgressMessage(null);
      skipFilterReload.current = false;
    }

    void init();
    return () => {
      cancelled = true;
      setProgressMessage(null);
    };
  }, [batch.id, loadRowsForFilter]);

  useEffect(() => {
    if (skipFilterReload.current) return;

    let cancelled = false;

    async function loadFilteredRows() {
      setLoading(true);
      setProgressMessage(IMPORT_PROGRESS.loadingRows);
      setError(null);
      await loadRowsForFilter(filter);
      if (!cancelled) {
        setLoading(false);
        setProgressMessage(null);
      }
    }

    void loadFilteredRows();
    return () => {
      cancelled = true;
    };
  }, [filter, loadRowsForFilter]);

  const visibleSelectableIds = useMemo(
    () => rows.filter(isSelectableReviewRow).map((r) => r.id),
    [rows],
  );

  const rowById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);

  const createNewSelectedIds = useMemo(
    () =>
      Array.from(selectedIds).filter((id) => {
        const row = rowById.get(id);
        return row ? isEligibleForBulkCreateNew(row) : false;
      }),
    [selectedIds, rowById],
  );

  const excludeSelectedIds = useMemo(
    () =>
      Array.from(selectedIds).filter((id) => {
        const row = rowById.get(id);
        return row ? isEligibleForBulkExclude(row) : false;
      }),
    [selectedIds, rowById],
  );

  const createNewSelectedCount = createNewSelectedIds.length;
  const excludeSelectedCount = excludeSelectedIds.length;

  const bulkCreateNewState = getBulkCreateNewButtonState(selectedIds, rows, {
    loading,
    actionLoading,
  });

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
    setProgressMessage(IMPORT_PROGRESS.loadingRows);
    setError(null);
    const listed = await fetchRows(batch.id, {
      status: filterStatusParam(filter),
      page: 1,
      pageSize: SPONSOR_IMPORT_MAX_ROWS,
    });
    setActionLoading(false);
    setProgressMessage(null);
    if (!listed.ok) {
      setError(listed.error);
      return;
    }
    setRows(listed.rows);
    setSummary(listed.summary);
    setSelectedIds(
      new Set(listed.rows.filter(isSelectableReviewRow).map((r) => r.id)),
    );
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleBulkAccept() {
    setActionLoading(true);
    setProgressMessage(IMPORT_PROGRESS.bulkAccept);
    setError(null);
    const result = await bulkAcceptDomains(batch.id);
    setActionLoading(false);
    setProgressMessage(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await reload();
  }

  async function handleImportToDraft() {
    setActionLoading(true);
    setProgressMessage(IMPORT_PROGRESS.importingToDraft);
    setError(null);
    const result = await importToDraft(batch.id);
    setActionLoading(false);
    setProgressMessage(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(flowHref(batch.id, "draft"));
  }

  async function applyBulkAction(action: PendingBulkAction) {
    const targetIds = action === "create_new" ? createNewSelectedIds : excludeSelectedIds;

    if (targetIds.length === 0) return;

    setActionLoading(true);
    setProgressMessage(IMPORT_PROGRESS.applyingDecisions);
    setBulkError(null);
    const result = await bulkApplyRowDecisions(batch.id, {
      decision_type: action,
      row_ids: targetIds,
    });
    setActionLoading(false);
    setProgressMessage(null);

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
            className={importFilterChipClass(filter === key)}
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
            ? `${bulkCreateNewState.selectedCount} selected · ${bulkCreateNewState.eligibleCount} eligible for create-new`
            : "Select rows for bulk actions"}
        </span>
      </div>

      {loading ? (
        <ImportProgressMessage message={progressMessage ?? IMPORT_PROGRESS.loadingRows} />
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
                <th className="px-4 py-2">Label</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
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
                      <td className="px-4 py-2">{resolveRowDomain(row) || "—"}</td>
                      <td className="px-4 py-2">{row.mapped_tier_rank ?? "—"}</td>
                      <td className="px-4 py-2">{row.mapped_tier_label ?? "—"}</td>
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
          disabled={!bulkCreateNewState.enabled}
          title={bulkCreateNewState.disabledReason ?? undefined}
          onClick={() => {
            setBulkError(null);
            setPendingBulk("create_new");
          }}
        >
          Create new companies for selected ({bulkCreateNewState.eligibleCount})
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
            {actionLoading && progressMessage === IMPORT_PROGRESS.bulkAccept
              ? "Accepting auto-ready matches…"
              : `Bulk accept domain matches (${summary.auto_ready})`}
          </Button>
        ) : null}
        <Button
          onClick={() => void handleImportToDraft()}
          disabled={!canImportToDraft || actionLoading || loading}
        >
          {actionLoading && progressMessage === IMPORT_PROGRESS.importingToDraft
            ? "Creating draft links…"
            : "Import to draft →"}
        </Button>
      </div>

      {bulkCreateNewState.disabledReason ? (
        <p className="text-sm text-amber-800">{bulkCreateNewState.disabledReason}</p>
      ) : null}

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
