"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/src/components/common";
import {
  type BrandfetchUpgradeBatchItem,
  eligibleBrandfetchUpgradeCompanyIds,
  runBrandfetchUpgradeBatch,
} from "@/src/lib/companies/brandfetchUpgradeBatchClient";

import { BrandfetchUpgradeBatchConfirmModal } from "./BrandfetchUpgradeBatchConfirmModal";
import { BrandfetchUpgradeBatchResults } from "./BrandfetchUpgradeBatchResults";

type PendingAction = "selected" | "all" | null;

type BrandfetchUpgradeBatchToolbarProps = {
  items: BrandfetchUpgradeBatchItem[];
  selectedCompanyIds: ReadonlySet<string>;
  disabled?: boolean;
};

export function BrandfetchUpgradeBatchToolbar({
  items,
  selectedCompanyIds,
  disabled = false,
}: BrandfetchUpgradeBatchToolbarProps) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [loading, setLoading] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [results, setResults] = useState<{
    upgraded: number;
    skipped: number;
    failed: number;
  } | null>(null);
  const [resultsError, setResultsError] = useState<string | null>(null);

  const eligibleSelectedIds = useMemo(
    () => eligibleBrandfetchUpgradeCompanyIds(items, selectedCompanyIds),
    [items, selectedCompanyIds],
  );
  const eligibleAllIds = useMemo(
    () => eligibleBrandfetchUpgradeCompanyIds(items),
    [items],
  );

  const pendingCompanyIds =
    pendingAction === "selected"
      ? eligibleSelectedIds
      : pendingAction === "all"
        ? eligibleAllIds
        : [];

  async function handleConfirm() {
    if (pendingCompanyIds.length === 0) {
      return;
    }

    setLoading(true);
    setConfirmError(null);
    setResults(null);
    setResultsError(null);

    try {
      const outcome = await runBrandfetchUpgradeBatch(pendingCompanyIds);
      if (!outcome.ok) {
        setConfirmError(outcome.error);
        setLoading(false);
        return;
      }

      setPendingAction(null);
      setResults({
        upgraded: outcome.upgraded,
        skipped: outcome.skipped,
        failed: outcome.failed,
      });
      router.refresh();
    } catch {
      setConfirmError("Brandfetch upgrade request failed.");
    } finally {
      setLoading(false);
    }
  }

  function handleCloseConfirm() {
    if (loading) return;
    setPendingAction(null);
    setConfirmError(null);
  }

  const eligibleTotal = eligibleAllIds.length;
  const selectedEligibleCount = eligibleSelectedIds.length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-sm text-slate-600">
          {eligibleTotal} eligible for Brandfetch upgrade
          {selectedCompanyIds.size > 0
            ? ` · ${selectedEligibleCount} eligible in selection`
            : null}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled || loading || selectedEligibleCount === 0}
            onClick={() => setPendingAction("selected")}
          >
            Upgrade selected logos
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled || loading || eligibleTotal === 0}
            onClick={() => setPendingAction("all")}
          >
            Upgrade all eligible logos
          </Button>
        </div>
      </div>

      {results || resultsError ? (
        <BrandfetchUpgradeBatchResults
          upgraded={results?.upgraded ?? 0}
          skipped={results?.skipped ?? 0}
          failed={results?.failed ?? 0}
          error={resultsError}
          onDismiss={() => {
            setResults(null);
            setResultsError(null);
          }}
        />
      ) : null}

      <BrandfetchUpgradeBatchConfirmModal
        open={pendingAction !== null}
        mode={pendingAction ?? "selected"}
        companyCount={pendingCompanyIds.length}
        loading={loading}
        error={confirmError}
        onClose={handleCloseConfirm}
        onConfirm={() => void handleConfirm()}
      />
    </div>
  );
}
