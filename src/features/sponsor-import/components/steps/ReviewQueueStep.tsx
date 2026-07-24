"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button, InlineErrorBanner } from "@/src/components/common";
import { importFilterChipClass } from "@/src/lib/design/classes";

import {
  bulkAcceptDomains,
  bulkApplyRowDecisions,
  fetchRows,
  importToDraft,
  materializeCompaniesChunk,
  materializeDraftLinksChunk,
  patchRowDecision,
  runMatching,
} from "../../client/api";
import {
  shouldShowImportToDraftButton,
  shouldSkipImportToDraftMaterialization,
} from "../../client/importDraftNavigation";
import type { RowSummary, SponsorImportRow } from "../../client/types";
import { SPONSOR_IMPORT_MAX_ROWS } from "../../types";
import { hasImportRowMatchReason } from "../../importRowMatchReason";
import { FINALIZE_IMPORT_TO_DRAFT_FAILED_MESSAGE } from "../../importToDraftClient";
import {
  materializeCompaniesProgressLabel,
  runCompanyMaterialization,
} from "../../materializeCompaniesClient";
import {
  materializeDraftLinksProgressLabel,
  runDraftLinkMaterialization,
} from "../../materializeDraftLinksClient";
import { IMPORT_PROGRESS } from "../../importProgress";
import {
  getBulkCreateNewButtonState,
  isEligibleForBulkCreateNew,
  isEligibleForBulkExclude,
  isSelectableReviewRow,
  resolveRowDomain,
} from "../../reviewQueueEligibility";
import { BulkReviewConfirmModal } from "../BulkReviewConfirmModal";
import { ImportRowMatchReason } from "../ImportRowMatchReason";
import { useSponsorImportWizard } from "../SponsorImportWizardContext";
import { useImportProgressLabel } from "../ImportFlowProgress";
import { ImportProgressMessage } from "../ImportProgressMessage";
import { RowDecisionDrawer } from "../RowDecisionDrawer";

type ReviewQueueStepProps = {
  initialSummary: RowSummary;
};

type FilterKey = "needs_review" | "auto_ready" | "all";

type PendingBulkAction = "create_new" | "exclude";

function filterStatusParam(filter: FilterKey): string | undefined {
  if (filter === "needs_review") return "needs_review";
  if (filter === "auto_ready") return "auto_ready";
  return undefined;
}

function importStatusMessage(summary: RowSummary, canImportToDraft: boolean): string {
  if (canImportToDraft) {
    return "All rows resolved. Ready to create the draft event.";
  }
  if (summary.auto_ready > 0) {
    const noun = summary.auto_ready === 1 ? "match" : "matches";
    return `Accept ${summary.auto_ready} auto-ready domain ${noun} in Step 1 before importing.`;
  }
  if (summary.needs_review > 0) {
    const noun = summary.needs_review === 1 ? "row" : "rows";
    return `${summary.needs_review} ${noun} still need review before import.`;
  }
  if (summary.pending_duplicate_count > 0) {
    const noun = summary.pending_duplicate_count === 1 ? "duplicate" : "duplicates";
    return `${summary.pending_duplicate_count} pending ${noun} must be resolved before import.`;
  }
  if (summary.blocking_validation_count > 0) {
    const noun = summary.blocking_validation_count === 1 ? "row" : "rows";
    return `${summary.blocking_validation_count} ${noun} with blocking validation issues.`;
  }
  return "Resolve remaining rows before importing to draft.";
}

function duplicateClusterSize(row: SponsorImportRow): number | null {
  const size = row.duplicate_cluster_size ?? null;
  return typeof size === "number" && size > 1 ? size : null;
}

function duplicateHelperText(row: SponsorImportRow): string | null {
  const size = duplicateClusterSize(row);
  if (!size) return null;
  if (row.status === "excluded") {
    return "Excluded automatically. Use this row instead only if its sponsorship details are correct.";
  }
  if (row.duplicate_resolution === "kept") {
    return "Selected automatically by sponsorship tier, then spreadsheet order.";
  }
  const otherCount = size - 1;
  const noun = otherCount === 1 ? "duplicate" : "duplicates";
  return `Choosing this row excludes the other ${otherCount} ${noun}.`;
}

function sponsorshipLabel(row: SponsorImportRow): { primary: string; secondary: string | null } {
  const label = row.mapped_tier_label?.trim() ?? "";
  const tier = row.mapped_tier_rank === null ? null : `Tier ${row.mapped_tier_rank}`;
  if (label !== "") {
    return { primary: label, secondary: tier };
  }
  return { primary: tier ?? "—", secondary: null };
}

function duplicateStatusLabel(row: SponsorImportRow): { primary: string; secondary: string | null } | null {
  if (!duplicateClusterSize(row)) return null;
  if (row.status === "excluded") {
    return { primary: "Excluded", secondary: "automatic duplicate" };
  }
  if (row.duplicate_resolution === "kept") {
    if (row.status === "resolved") return { primary: "Selected", secondary: "will import" };
    if (row.status === "auto_ready") return { primary: "Selected", secondary: "auto-ready" };
    return { primary: "Selected", secondary: "needs review" };
  }
  return { primary: "Duplicate", secondary: "needs choice" };
}

export function ReviewQueueStep({ initialSummary }: ReviewQueueStepProps) {
  const { batch, goToStep, openDraftStep } = useSponsorImportWizard();
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
  const [duplicateConfirmation, setDuplicateConfirmation] = useState(false);
  const [acceptedDomainMatchCount, setAcceptedDomainMatchCount] = useState<number | null>(null);
  const [step1DetailsOpen, setStep1DetailsOpen] = useState(false);
  const skipFilterReload = useRef(true);
  const bulkAcceptInFlight = useRef(false);
  const importToDraftInFlight = useRef(false);
  const bulkActionInFlight = useRef(false);

  useImportProgressLabel(Boolean(progressMessage), progressMessage);

  const batchAlreadyDraft = shouldSkipImportToDraftMaterialization(batch.status);

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
    if (batchAlreadyDraft) {
      openDraftStep();
    }
  }, [batchAlreadyDraft, openDraftStep]);

  useEffect(() => {
    if (batchAlreadyDraft) return;

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

      await loadRowsForFilter("needs_review");
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
  }, [batch.id, batchAlreadyDraft, loadRowsForFilter]);

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
  const showStep1 = canBulkAccept || acceptedDomainMatchCount !== null;
  const step1Collapsed = !canBulkAccept && acceptedDomainMatchCount !== null;
  const canImportToDraft =
    shouldShowImportToDraftButton(batch.status) &&
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
    if (bulkAcceptInFlight.current) return;
    bulkAcceptInFlight.current = true;
    setActionLoading(true);
    setProgressMessage(IMPORT_PROGRESS.bulkAccept);
    setError(null);
    try {
      const autoReadyBeforeAccept = summary.auto_ready;
      const result = await bulkAcceptDomains(batch.id);
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

  async function handleKeepDuplicateRow(row: SponsorImportRow) {
    if (actionLoading) return;
    setActionLoading(true);
    setProgressMessage(IMPORT_PROGRESS.applyingDecisions);
    setError(null);
    setDuplicateConfirmation(false);
    try {
      const result = await patchRowDecision(batch.id, row.id, {
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

  async function handleImportToDraft() {
    if (importToDraftInFlight.current) return;
    importToDraftInFlight.current = true;
    setActionLoading(true);
    setError(null);

    try {
      if (shouldSkipImportToDraftMaterialization(batch.status)) {
        openDraftStep();
        return;
      }

      setProgressMessage(IMPORT_PROGRESS.materializingCompanies);

      const materialized = await runCompanyMaterialization(
        (cursor) =>
          materializeCompaniesChunk(batch.id, cursor === undefined ? {} : { cursor }),
        {
          onProgress: (progress) =>
            setProgressMessage(materializeCompaniesProgressLabel(progress)),
        },
      );
      if (!materialized.ok) {
        setError(materialized.error);
        return;
      }

      const linked = await runDraftLinkMaterialization(
        (cursor) =>
          materializeDraftLinksChunk(batch.id, cursor === undefined ? {} : { cursor }),
        {
          onProgress: (progress) =>
            setProgressMessage(materializeDraftLinksProgressLabel(progress)),
        },
      );
      if (!linked.ok) {
        setError(linked.error);
        return;
      }

      setProgressMessage(IMPORT_PROGRESS.finalizingDraft);
      const result = await importToDraft(batch.id);
      if (!result.ok) {
        setError(result.error || FINALIZE_IMPORT_TO_DRAFT_FAILED_MESSAGE);
        return;
      }
      openDraftStep();
    } finally {
      importToDraftInFlight.current = false;
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
      const result = await bulkApplyRowDecisions(batch.id, {
        decision_type: action,
        row_ids: targetIds,
      });

      if (!result.ok) {
        setBulkError(result.error);
        return;
      }

      setPendingBulk(null);
      setBulkError(null);
      clearSelection();
      await reload();
    } finally {
      bulkActionInFlight.current = false;
      setActionLoading(false);
      setProgressMessage(null);
    }
  }

  const pendingBulkCount =
    pendingBulk === "create_new" ? createNewSelectedCount : excludeSelectedCount;

  const importStatus = importStatusMessage(summary, canImportToDraft);
  const importToDraftInProgress =
    actionLoading &&
    (progressMessage?.startsWith("Creating companies") ||
      progressMessage?.startsWith("Creating draft links") ||
      progressMessage?.startsWith("Finalizing draft"));

  return (
    <div className="pb-28">
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

        {showStep1 ? (
          step1Collapsed ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-slate-900">
                  Step 1 · Accept domain matches
                </span>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-900">
                  Completed
                </span>
                <span className="text-sm text-slate-600">
                  {acceptedDomainMatchCount === 1
                    ? "1 domain match accepted"
                    : `${acceptedDomainMatchCount} domain matches accepted`}
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
                  Auto-ready domain matches were accepted and linked to existing companies.
                  Continue with Step 2 for any remaining rows.
                </p>
              ) : null}
            </div>
          ) : (
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Step 1 · Accept domain matches
                  </h3>
                  <p className="mt-1 max-w-2xl text-sm text-slate-600">
                    Accept rows where the spreadsheet domain clearly matches an existing company.
                    Do this first so Step 2 only shows rows that still need a decision.
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
                  Bulk accept domain matches ({summary.auto_ready})
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
              Work through unmatched or ambiguous rows. Select all matching rows, then create new
              companies. Use <span className="font-medium">Decide</span> on individual rows for
              duplicates, conflicts, or rows you want to skip.
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
              <p className="font-medium">✓ Duplicate resolved.</p>
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
                      <th className="px-4 py-2">Company</th>
                      <th className="px-4 py-2">Match</th>
                      <th className="px-4 py-2">Domain</th>
                      <th className="px-4 py-2">Sponsorship</th>
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
                        const sponsorship = sponsorshipLabel(row);
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
                            <td className="px-4 py-2">
                              <div>{row.raw_company_name ?? "—"}</div>
                              {duplicateSize ? (
                                <div className="mt-1 max-w-xs space-y-0.5 text-xs text-slate-600">
                                  <p className="font-semibold text-slate-800">
                                    Duplicate ({duplicateSize} rows)
                                  </p>
                                  {row.duplicate_resolution === "kept" ? (
                                    <p className="font-medium text-emerald-800">
                                      Selected by default.
                                    </p>
                                  ) : row.status === "excluded" ? (
                                    <p className="font-medium text-slate-700">
                                      Not selected by default.
                                    </p>
                                  ) : (
                                    <p className="font-medium text-slate-700">
                                      Review this duplicate.
                                    </p>
                                  )}
                                  <p>{duplicateHelperText(row)}</p>
                                </div>
                              ) : null}
                            </td>
                            <td className="max-w-xs px-4 py-2">
                              {hasImportRowMatchReason(row) || row.proposed_company_id ? (
                                <ImportRowMatchReason
                                  row={row}
                                  layout="compact"
                                  showMatchedCompany={Boolean(row.proposed_company_id)}
                                />
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-4 py-2">{resolveRowDomain(row) || "—"}</td>
                            <td className="px-4 py-2">
                              <div className="font-semibold text-slate-900">
                                {sponsorship.primary}
                              </div>
                              {sponsorship.secondary ? (
                                <div className="text-xs text-slate-500">
                                  {sponsorship.secondary}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-4 py-2">
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
                            <td className="sticky right-0 bg-white px-4 py-2 shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]">
                              {duplicateSize && row.status === "excluded" ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={actionLoading}
                                  onClick={() => void handleKeepDuplicateRow(row)}
                                >
                                  Use this row instead
                                </Button>
                              ) : row.status === "needs_review" ? (
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

        {error ? <InlineErrorBanner message={error} /> : null}
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900">Step 3 · Import to draft</p>
            <p
              className={
                canImportToDraft ? "text-sm text-emerald-800" : "text-sm text-slate-600"
              }
            >
              {importStatus}
            </p>
            {importToDraftInProgress ? (
              <div className="mt-2">
                <ImportProgressMessage message={progressMessage ?? IMPORT_PROGRESS.finalizingDraft} />
              </div>
            ) : null}
          </div>
          <Button
            variant="secondary"
            onClick={() => goToStep("validation")}
            disabled={actionLoading}
          >
            Back
          </Button>
          {batchAlreadyDraft ? (
            <Button onClick={() => openDraftStep()} disabled={actionLoading}>
              Open draft →
            </Button>
          ) : (
            <Button
              onClick={() => void handleImportToDraft()}
              disabled={!canImportToDraft || actionLoading || loading}
              aria-busy={importToDraftInProgress}
            >
              Import to draft →
            </Button>
          )}
        </div>
      </div>

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
