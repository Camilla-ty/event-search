"use client";

import { Button } from "@/src/components/common";
import { feedbackErrorClass } from "@/src/lib/design/classes";

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
  if (!open) return null;

  const title =
    action === "create_new"
      ? "Create new companies for selected rows?"
      : "Exclude selected rows?";

  const message =
    action === "create_new"
      ? `This will mark ${count} row${count === 1 ? "" : "s"} to create new companies during draft import.`
      : `This will exclude ${count} row${count === 1 ? "" : "s"} from the import.`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-review-confirm-title"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg"
      >
        <h2 id="bulk-review-confirm-title" className="text-lg font-semibold text-slate-900">
          {title}
        </h2>
        <p className="mt-3 text-sm text-slate-600">{message}</p>
        {error ? <p className={`mt-3 ${feedbackErrorClass}`}>{error}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={loading}>
            {loading ? "Applying…" : "Confirm"}
          </Button>
        </div>
      </div>
    </div>
  );
}
