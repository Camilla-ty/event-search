"use client";

import { useEffect, useRef } from "react";

import { Button } from "@/src/components/common";
import { feedbackErrorClass, secondaryCtaClass } from "@/src/lib/design/classes";

type BulkReviewConfirmModalProps = {
  open: boolean;
  action: "create_new" | "exclude";
  count: number;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
};

export function BulkReviewConfirmModal({
  open,
  action,
  count,
  loading,
  error,
  onClose,
  onConfirm,
}: BulkReviewConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const title =
    action === "create_new"
      ? `Create new companies for ${count} selected row${count === 1 ? "" : "s"}?`
      : `Exclude ${count} selected row${count === 1 ? "" : "s"}?`;

  const message =
    action === "create_new"
      ? `This marks ${count} row${count === 1 ? "" : "s"} for explicit company creation during import. They will appear in the create-new count before materialization.`
      : `This excludes ${count} row${count === 1 ? "" : "s"} from the import.`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-3 text-sm text-slate-600">{message}</p>
        {action === "create_new" ? (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-900">
            +{count} create-new row{count === 1 ? "" : "s"} will be added to the import plan.
          </p>
        ) : null}
        {loading ? (
          <p className="mt-3 text-sm text-slate-600" role="status">
            Applying…
          </p>
        ) : null}
        {error ? <p className={`mt-3 ${feedbackErrorClass}`}>{error}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            className={`${secondaryCtaClass} h-8 px-3 text-sm`}
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <Button onClick={onConfirm} disabled={loading}>
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}
