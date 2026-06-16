"use client";

import { useEffect, useRef } from "react";

import { Button } from "@/src/components/common";
import { BRANDFETCH_UPGRADE_BATCH_LIMIT } from "@/src/lib/companies/brandfetchUpgradeBatchClient";
import { secondaryCtaClass } from "@/src/lib/design/classes";

type BrandfetchUpgradeBatchConfirmModalProps = {
  open: boolean;
  companyCount: number;
  mode: "selected" | "all";
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
};

export function BrandfetchUpgradeBatchConfirmModal({
  open,
  companyCount,
  mode,
  loading,
  error,
  onClose,
  onConfirm,
}: BrandfetchUpgradeBatchConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      cancelRef.current?.focus();
    }
  }, [open]);

  if (!open) return null;

  const requestCount = Math.ceil(companyCount / BRANDFETCH_UPGRADE_BATCH_LIMIT);
  const batchNote =
    requestCount > 1
      ? ` This will send ${requestCount} requests (${BRANDFETCH_UPGRADE_BATCH_LIMIT} companies per request).`
      : "";

  const title =
    mode === "selected" ? "Upgrade selected logos with Brandfetch?" : "Upgrade all eligible logos?";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="brandfetch-batch-confirm-title"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="brandfetch-batch-confirm-title" className="text-lg font-semibold text-slate-900">
          {title}
        </h2>
        <p className="mt-3 text-sm text-slate-600">
          {companyCount} compan{companyCount === 1 ? "y" : "ies"} will be sent to Brandfetch for
          logo download and storage.{batchNote} Manual logos and companies that already have
          Brandfetch logos are skipped automatically.
        </p>
        {loading ? (
          <p className="mt-3 text-sm text-slate-600" role="status" aria-live="polite">
            Downloading logos from Brandfetch…
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            className={`${secondaryCtaClass} h-8 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50`}
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <Button type="button" onClick={onConfirm} disabled={loading}>
            {loading ? "Upgrading…" : "Confirm upgrade"}
          </Button>
        </div>
      </div>
    </div>
  );
}
