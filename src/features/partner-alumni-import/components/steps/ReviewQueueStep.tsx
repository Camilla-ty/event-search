"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, InlineErrorBanner } from "@/src/components/common";
import { importFilterChipClass } from "@/src/lib/design/classes";
import { ImportProgressMessage } from "@/src/features/sponsor-import/components/ImportProgressMessage";
import { useImportProgressLabel } from "@/src/features/sponsor-import/components/ImportFlowProgress";

import {
  acknowledgeCreateNew,
  acknowledgeReview,
  bulkAcceptDomains,
  bulkApplyRowDecisions,
  fetchRows,
  patchRowDecision,
  runMatching,
} from "../../client/api";
import { flowHref } from "../../client/resumeStep";
import type {
  ImportScope,
  MatchMethodSummary,
  MaterializePreviewSummary,
  PartnerAlumniImportBatch,
  PartnerAlumniImportRow,
  RowSummary,
} from "../../client/types";
import { PARTNER_ALUMNI_IMPORT_MAX_ROWS } from "../../types";
import { IMPORT_PROGRESS } from "../../importProgress";
import { runPartnerAlumniImportMaterialization } from "../../materializeImportClient";
import {
  runReviewQueueInit,
  shouldRunMatchingOnReviewMount,
} from "../../reviewQueueInit";
import {
  duplicateClusterSize,
  duplicateHelperText,
  duplicateStatusLabel,
  spreadsheetCompanyLabel,
  spreadsheetWebsiteLabel,
} from "../../reviewRowDisplay";
import {
  getBulkCreateNewButtonState,
  isEligibleForBulkCreateNew,
  isEligibleForBulkExclude,
  isSelectableReviewRow,
  resolveRowDomain,
} from "../../reviewQueueEligibility";
import { BulkReviewConfirmModal } from "../BulkReviewConfirmModal";
import { CreateNewAcknowledgmentModal } from "../CreateNewAcknowledgmentModal";
import { MatchMethodSummaryCards } from "../MatchMethodSummaryCards";
import { MaterializePreviewPanel } from "../MaterializePreviewPanel";
import { ReviewRowMatchCell } from "../ReviewRowMatchCell";
import { RowDecisionDrawer } from "../RowDecisionDrawer";

type ReviewQueueStepProps = {
  scope: ImportScope;
  batch: PartnerAlumniImportBatch;
  initialSummary: RowSummary;
  initialMatchMethodSummary: MatchMethodSummary;
  initialMaterializePreview: MaterializePreviewSummary;
  initialPendingCreateNewCount: number;
};

type FilterKey = "needs_review" | "auto_ready" | "all";
type PendingBulkAction = "create_new" | "exclude";

function filterStatusParam(filter: FilterKey): string | undefined {
  if (filter === "needs_review") return "needs_review";
  if (filter === "auto_ready") return "auto_ready";
  return undefined;
}

function importStatusMessage(summary: RowSummary, canImport: boolean): string {
  if (canImport) {
    return "All rows resolved. Ready to import to this version.";
  }
  if (summary.auto_ready > 0) {
    const noun = summary.auto_ready === 1 ? "match" : "matches";
    return `Accept ${summary.auto_ready} auto-ready ${noun} in Step 1 before importing.`;
  }
  if (summary.needs_review > 0) {
    const noun = summary.needs_review === 1 ? "row" : "rows";
    return `${summary.needs_review} ${noun} still need review before import.`;
  }
  if (summary.pending_duplicate_count > 0) {
    return `${summary.pending_duplicate_count} duplicate row(s) must be resolved before import.`;
  }
  if (summary.blocking_validation_count > 0) {
    return `${summary.blocking_validation_count} row(s) with blocking validation issues.`;
  }
  return "Resolve remaining rows before import.";
}

export function ReviewQueueStep({
  scope,
  batch,
  initialSummary,
  initialMatchMethodSummary,
  initialMaterializePreview,
  initialPendingCreateNewCount,
}: ReviewQueueStepProps) {
  const router = useRouter();
  const mountSummaryRef = useRef(initialSummary);
  const seriesId = scope.seriesId;
  const versionId = scope.versionId;
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | null>(() =>
    shouldRunMatchingOnReviewMount(mountSummaryRef.current)
      ? IMPORT_PROGRESS.matching
      : IMPORT_PROGRESS.loadingRows,
  );
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState(initialSummary);
  const [matchMethodSummary, setMatchMethodSummary] = useState(initialMatchMethodSummary);
  const [materializePreview, setMaterializePreview] = useState(initialMaterializePreview);
  const [pendingCreateNewCount, setPendingCreateNewCount] = useState(initialPendingCreateNewCount);
  const [rows, setRows] = useState<PartnerAlumniImportRow[]>([]);
  const [filter, setFilter] = useState<FilterKey>("needs_review");
  const [selectedRow, setSelectedRow] = useState<PartnerAlumniImportRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingBulk, setPendingBulk] = useState<PendingBulkAction | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [duplicateConfirmation, setDuplicateConfirmation] = useState(false);
  const [acceptedDomainMatchCount, setAcceptedDomainMatchCount] = useState<number | null>(null);
  const [step1DetailsOpen, setStep1DetailsOpen] = useState(false);
  const [createNewAckOpen, setCreateNewAckOpen] = useState(false);
  const [createNewAckError, setCreateNewAckError] = useState<string | null>(null);
  const skipFilterReload = useRef(true);
  const initGenerationRef = useRef(0);
  const filterGenerationRef = useRef(0);
  const bulkAcceptInFlight = useRef(false);
  const importInFlight = useRef(false);
  const bulkActionInFlight = useRef(false);

  useImportProgressLabel(Boolean(progressMessage), progressMessage);

  const applyListResult = useCallback(
    (listed: {
      summary: RowSummary;
      match_method_summary: MatchMethodSummary;
      materialize_preview: MaterializePreviewSummary;
      pending_create_new_count: number;
      rows: PartnerAlumniImportRow[];
    }) => {
      setSummary(listed.summary);
      setMatchMethodSummary(listed.match_method_summary);
      setMaterializePreview(listed.materialize_preview);
      setPendingCreateNewCount(listed.pending_create_new_count);
      setRows(listed.rows);
      setSelectedIds((prev) => {
        const visible = new Set(listed.rows.map((r) => r.id));
        return new Set(Array.from(prev).filter((id) => visible.has(id)));
      });
    },
    [],
  );

  const loadRowsForFilter = useCallback(
    async (activeFilter: FilterKey) => {
      const listed = await fetchRows(
        { seriesId, versionId },
        batch.id,
        {
          status: filterStatusParam(activeFilter),
          page: 1,
          pageSize: PARTNER_ALUMNI_IMPORT_MAX_ROWS,
        },
      );
      if (!listed.ok) {
        setError(listed.error);
        return false;
      }
      applyListResult(listed);
      return true;
    },
    [applyListResult, batch.id, seriesId, versionId],
  );

  const reload = useCallback(async () => {
    await loadRowsForFilter(filter);
  }, [filter, loadRowsForFilter]);

  useEffect(() => {
    const generation = ++initGenerationRef.current;
    let cancelled = false;

    async function init() {
      const mountSummary = mountSummaryRef.current;
      const showMatching = shouldRunMatchingOnReviewMount(mountSummary);
      setLoading(true);
      setProgressMessage(
        showMatching ? IMPORT_PROGRESS.matching : IMPORT_PROGRESS.loadingRows,
      );
      setError(null);
      skipFilterReload.current = true;

      try {
        const result = await runReviewQueueInit({
          summary: mountSummary,
          runMatching: () =>
            runMatching({ seriesId, versionId }, batch.id),
          loadRows: () => loadRowsForFilter("needs_review"),
          isCancelled: () =>
            cancelled || generation !== initGenerationRef.current,
        });

        if (cancelled || generation !== initGenerationRef.current) {
          return;
        }

        if (!result.ok && !result.cancelled && result.error) {
          setError(result.error);
        }
      } finally {
        if (!cancelled && generation === initGenerationRef.current) {
          setLoading(false);
          setProgressMessage(null);
          skipFilterReload.current = false;
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [batch.id, loadRowsForFilter, seriesId, versionId]);

  useEffect(() => {
    if (skipFilterReload.current) return;

    const generation = ++filterGenerationRef.current;
    let cancelled = false;

    async function loadFilteredRows() {
      setLoading(true);
      setProgressMessage(IMPORT_PROGRESS.loadingRows);
      setError(null);
      try {
        await loadRowsForFilter(filter);
      } finally {
        if (!cancelled && generation === filterGenerationRef.current) {
          setLoading(false);
          setProgressMessage(null);
        }
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
    [rowById, selectedIds],
  );

  const excludeSelectedIds = useMemo(
    () =>
      Array.from(selectedIds).filter((id) => {
        const row = rowById.get(id);
        return row ? isEligibleForBulkExclude(row) : false;
      }),
    [rowById, selectedIds],
  );

  const bulkCreateNewState = getBulkCreateNewButtonState(selectedIds, rows, {
    loading,
    actionLoading,
  });

  const allVisibleSelected =
    visibleSelectableIds.length > 0 &&
    visibleSelectableIds.every((id) => selectedIds.has(id));

  const canBulkAccept = summary.auto_ready > 0;
  const showStep1 = canBulkAccept || acceptedDomainMatchCount !== null;
  const step1Collapsed = !canBulkAccept && acceptedDomainMatchCount !== null;

  const canImport =
    summary.auto_ready === 0 &&
    summary.needs_review === 0 &&
    summary.pending_duplicate_count === 0 &&
    summary.blocking_validation_count === 0 &&
    summary.resolved > 0;

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

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function selectAllMatchingFilter() {
    setActionLoading(true);
    setProgressMessage(IMPORT_PROGRESS.loadingRows);
    setError(null);
    const listed = await fetchRows(scope, batch.id, {
      status: filterStatusParam(filter),
      page: 1,
      pageSize: PARTNER_ALUMNI_IMPORT_MAX_ROWS,
    });
    setActionLoading(false);
    setProgressMessage(null);
    if (!listed.ok) {
      setError(listed.error);
      return;
    }
    applyListResult(listed);
    setSelectedIds(new Set(listed.rows.filter(isSelectableReviewRow).map((r) => r.id)));
  }

  async function handleBulkAccept() {
    if (bulkAcceptInFlight.current) return;
    bulkAcceptInFlight.current = true;
    setActionLoading(true);
    setProgressMessage(IMPORT_PROGRESS.bulkAccept);
    setError(null);
    try {
      const autoReadyBeforeAccept = summary.auto_ready;
      const result = await bulkAcceptDomains(scope, batch.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const acceptedCount = result.accepted_count;
      if (acceptedCount === 0 && autoReadyBeforeAccept > 0) {
        setError(
          "No auto-ready rows were accepted. Refresh the page or resolve the remaining rows manually.",
        );
        await reload();
        return;
      }
      if (acceptedCount > 0) {
        setAcceptedDomainMatchCount(acceptedCount);
        setStep1DetailsOpen(false);
      }
      await reload();
    } finally {
      bulkAcceptInFlight.current = false;
      setActionLoading(false);
      setProgressMessage(null);
    }
  }

  async function handleKeepDuplicateRow(row: PartnerAlumniImportRow) {
    if (actionLoading) return;
    setActionLoading(true);
    setProgressMessage(IMPORT_PROGRESS.applyingDecisions);
    setError(null);
    setDuplicateConfirmation(false);
    try {
      const result = await patchRowDecision(scope, batch.id, row.id, {
        decision_type: row.proposed_company_id ? "use_matched" : "create_new",
        duplicate_resolution: "kept",
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDuplicateConfirmation(true);
      clearSelection();
      await reload();
    } finally {
      setActionLoading(false);
      setProgressMessage(null);
    }
  }

  async function applyBulkAction(action: PendingBulkAction) {
    if (bulkActionInFlight.current) return;
    const targetIds = action === "create_new" ? createNewSelectedIds : excludeSelectedIds;
    if (targetIds.length === 0) return;

    bulkActionInFlight.current = true;
    setActionLoading(true);
    setProgressMessage(IMPORT_PROGRESS.applyingDecisions);
    setBulkError(null);
    try {
      const result = await bulkApplyRowDecisions(scope, batch.id, {
        decision_type: action,
        row_ids: targetIds,
      });
      if (!result.ok) {
        setBulkError(result.error);
        return;
      }
      setPendingBulk(null);
      clearSelection();
      await reload();
    } finally {
      bulkActionInFlight.current = false;
      setActionLoading(false);
      setProgressMessage(null);
    }
  }

  async function runImportAfterAcks() {
    setActionLoading(true);
    setError(null);

    const review = await acknowledgeReview(scope, batch.id);
    if (!review.ok) {
      setActionLoading(false);
      setError(review.error);
      return;
    }

    if (pendingCreateNewCount > 0) {
      const ack = await acknowledgeCreateNew(scope, batch.id, pendingCreateNewCount);
      if (!ack.ok) {
        setActionLoading(false);
        setError(ack.error);
        return;
      }
    }

    const materialized = await runPartnerAlumniImportMaterialization(scope, batch.id, (msg) =>
      setProgressMessage(msg),
    );
    setActionLoading(false);
    setProgressMessage(null);

    if (!materialized.ok) {
      setError(materialized.error);
      return;
    }

    router.push(flowHref(scope, batch.id, "summary"));
  }

  async function handleImportClick() {
    if (pendingCreateNewCount > 0 && !batch.create_new_acknowledged_at) {
      setCreateNewAckOpen(true);
      return;
    }
    await runImportAfterAcks();
  }

  async function handleCreateNewAckConfirm() {
    setCreateNewAckError(null);
    setActionLoading(true);
    const ack = await acknowledgeCreateNew(scope, batch.id, pendingCreateNewCount);
    if (!ack.ok) {
      setActionLoading(false);
      setCreateNewAckError(ack.error);
      return;
    }
    setCreateNewAckOpen(false);
    await runImportAfterAcks();
  }

  const pendingBulkCount =
    pendingBulk === "create_new" ? createNewSelectedIds.length : excludeSelectedIds.length;
  const importStatus = importStatusMessage(summary, canImport);
  const importInProgress =
    actionLoading &&
    (progressMessage?.startsWith("Creating companies") ||
      progressMessage?.startsWith("Linking version members"));

  return (
    <div className="pb-28">
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Review queue</h2>
          <p className="mt-1 text-sm text-slate-600">
            Resolve company matches and duplicates before importing. Compare spreadsheet values with
            proposed catalog matches in the table below — use Decide for conflicts or duplicates.
          </p>
        </div>

        <MatchMethodSummaryCards
          summary={matchMethodSummary}
          resolvedCount={summary.resolved}
        />

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

        {showStep1 ? (
          step1Collapsed ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-slate-900">
                  Step 1 · Accept domain & alias matches
                </span>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-900">
                  Completed
                </span>
                <span className="text-sm text-slate-600">
                  {acceptedDomainMatchCount === 1
                    ? "1 match accepted"
                    : `${acceptedDomainMatchCount} matches accepted`}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => setStep1DetailsOpen((open) => !open)}
                >
                  {step1DetailsOpen ? "Hide details" : "Show details"}
                </Button>
              </div>
              {step1DetailsOpen ? (
                <p className="mt-3 text-sm text-slate-600">
                  Auto-ready domain and alias matches were accepted. Continue with Step 2 for
                  remaining rows.
                </p>
              ) : null}
            </div>
          ) : (
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Step 1 · Accept domain & alias matches
                  </h3>
                  <p className="mt-1 max-w-2xl text-sm text-slate-600">
                    Accept rows where the spreadsheet clearly matches an existing company by domain
                    or alias.
                  </p>
                </div>
                <span className="rounded-md bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-950">
                  {summary.auto_ready} rows
                </span>
              </div>
              <div className="mt-4">
                <Button
                  onClick={() => void handleBulkAccept()}
                  disabled={actionLoading || loading}
                >
                  Bulk accept domain & alias matches ({summary.auto_ready})
                </Button>
              </div>
            </section>
          )
        ) : null}

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Step 2 · Resolve remaining companies
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Review spreadsheet vs catalog details for each row. Select rows for bulk create-new or
              exclude; use <span className="font-medium">Decide</span> for name matches, conflicts,
              and duplicates.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
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
                {key === "needs_review"
                  ? "Needs review"
                  : key === "auto_ready"
                    ? "Auto-ready"
                    : "All"}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <Button
              type="button"
              size="sm"
              disabled={loading || actionLoading}
              onClick={() => void selectAllMatchingFilter()}
            >
              Select all matching filter
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!bulkCreateNewState.enabled}
              title={bulkCreateNewState.disabledReason ?? undefined}
              onClick={() => {
                setBulkError(null);
                setPendingBulk("create_new");
              }}
            >
              Create new ({bulkCreateNewState.eligibleCount})
            </Button>
            {selectedIds.size > 0 ? (
              <Button type="button" variant="secondary" size="sm" onClick={clearSelection}>
                Clear selection ({selectedIds.size})
              </Button>
            ) : null}
            <span className="text-slate-500 sm:ml-auto">
              {selectedIds.size > 0
                ? `${bulkCreateNewState.selectedCount} selected · ${bulkCreateNewState.eligibleCount} eligible for create-new`
                : "Select rows for bulk actions"}
            </span>
          </div>

          {bulkCreateNewState.disabledReason ? (
            <p className="mt-3 text-sm text-amber-800">{bulkCreateNewState.disabledReason}</p>
          ) : null}

          {duplicateConfirmation ? (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <p className="font-medium">Duplicate resolved.</p>
              <p>Other duplicate rows were excluded.</p>
            </div>
          ) : null}

          <div className="mt-4">
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
                      <th className="min-w-[10rem] px-4 py-2">Spreadsheet company</th>
                      <th className="min-w-[10rem] px-4 py-2">Spreadsheet domain</th>
                      <th className="min-w-[14rem] px-4 py-2">Proposed match</th>
                      <th className="px-4 py-2">Order</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="sticky right-0 bg-slate-50 px-4 py-2 shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]">
                        Actions
                      </th>
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
                        const duplicateSize = duplicateClusterSize(row);
                        const duplicateStatus = duplicateStatusLabel(row);
                        const company = spreadsheetCompanyLabel(row);
                        const sheetWebsite = spreadsheetWebsiteLabel(row);
                        const domain = resolveRowDomain(row);

                        return (
                          <tr key={row.id} className="border-b border-slate-100 align-top">
                            <td className="px-4 py-3">
                              {selectable ? (
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(row.id)}
                                  onChange={() => toggleRow(row.id)}
                                  aria-label={`Select row ${row.excel_row_number}`}
                                />
                              ) : null}
                            </td>
                            <td className="px-4 py-3">{row.excel_row_number}</td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-900">{company.primary}</div>
                              {company.secondary ? (
                                <div className="mt-0.5 text-xs text-slate-500">
                                  {company.secondary}
                                </div>
                              ) : null}
                              {duplicateSize ? (
                                <div className="mt-2 max-w-md space-y-0.5 text-xs text-slate-600">
                                  <p className="font-semibold text-slate-800">
                                    Duplicate ({duplicateSize} rows)
                                  </p>
                                  <p>{duplicateHelperText(row)}</p>
                                </div>
                              ) : null}
                            </td>
                            <td className="px-4 py-3">
                              <div>{domain || "—"}</div>
                              {sheetWebsite && sheetWebsite !== domain ? (
                                <div className="mt-0.5 text-xs text-slate-500">
                                  Sheet: {sheetWebsite}
                                </div>
                              ) : null}
                              {row.normalized_website && row.normalized_website !== domain ? (
                                <div className="mt-0.5 text-xs text-slate-500">
                                  Normalized: {row.normalized_website}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-4 py-3">
                              <ReviewRowMatchCell row={row} />
                            </td>
                            <td className="px-4 py-3">{row.mapped_display_order ?? "—"}</td>
                            <td className="px-4 py-3">
                              {duplicateStatus ? (
                                <span>
                                  <span>{duplicateStatus.primary}</span>
                                  {duplicateStatus.secondary ? (
                                    <span className="ml-2 text-xs text-slate-500">
                                      {duplicateStatus.secondary}
                                    </span>
                                  ) : null}
                                </span>
                              ) : (
                                <span>{row.status}</span>
                              )}
                              {selectable && !canCreateNew ? (
                                <span className="ml-2 text-xs text-slate-500">(exclude only)</span>
                              ) : null}
                            </td>
                            <td className="sticky right-0 bg-white px-4 py-3 shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]">
                              {duplicateSize && row.status === "excluded" ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={actionLoading}
                                  onClick={() => void handleKeepDuplicateRow(row)}
                                >
                                  Use this row instead
                                </Button>
                              ) : row.status === "needs_review" || row.status === "auto_ready" ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => setSelectedRow(row)}
                                >
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
          </div>
        </section>

        <MaterializePreviewPanel preview={materializePreview} canImport={canImport} />

        {canImport && pendingCreateNewCount > 0 ? (
          <div
            role="alert"
            className="rounded-lg border-2 border-rose-400 bg-rose-50 px-4 py-3 text-rose-950"
          >
            <p className="text-base font-bold">
              Import will create {pendingCreateNewCount} new{" "}
              {pendingCreateNewCount === 1 ? "company" : "companies"}
            </p>
            <p className="mt-1 text-sm">You must acknowledge this count before import runs.</p>
          </div>
        ) : null}

        {error ? <InlineErrorBanner message={error} /> : null}
        {bulkError ? <InlineErrorBanner message={bulkError} /> : null}
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900">Step 3 · Import to version</p>
            <p className={canImport ? "text-sm text-emerald-800" : "text-sm text-slate-600"}>
              {importStatus}
            </p>
            {importInProgress ? (
              <div className="mt-2">
                <ImportProgressMessage message={progressMessage ?? IMPORT_PROGRESS.materializingCompanies} />
              </div>
            ) : null}
          </div>
          <Button
            variant="secondary"
            onClick={() => router.push(flowHref(scope, batch.id, "validation"))}
            disabled={actionLoading}
          >
            Back
          </Button>
          <Button
            onClick={() => {
              if (importInFlight.current) return;
              importInFlight.current = true;
              handleImportClick().finally(() => {
                importInFlight.current = false;
              });
            }}
            disabled={!canImport || actionLoading || loading}
            aria-busy={importInProgress}
          >
            {actionLoading ? "Importing…" : "Import to version →"}
          </Button>
        </div>
      </div>

      <RowDecisionDrawer
        scope={scope}
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

      <CreateNewAcknowledgmentModal
        open={createNewAckOpen}
        count={pendingCreateNewCount}
        totalRows={summary.total}
        loading={actionLoading}
        error={createNewAckError}
        onClose={() => setCreateNewAckOpen(false)}
        onConfirm={() => void handleCreateNewAckConfirm()}
      />
    </div>
  );
}
