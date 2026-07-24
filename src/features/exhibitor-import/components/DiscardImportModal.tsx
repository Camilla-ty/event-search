"use client";

import { useState } from "react";

import { Button } from "@/src/components/common";
import { feedbackErrorClass } from "@/src/lib/design/classes";

import { discardBatch } from "../client/api";

type DiscardImportModalProps = {
  batchId: string;
  open: boolean;
  onClose: () => void;
  onDiscarded: () => void;
};

export function DiscardImportModal({
  batchId,
  open,
  onClose,
  onDiscarded,
}: DiscardImportModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    const result = await discardBatch(batchId);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onDiscarded();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="discard-import-title"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg"
      >
        <h2 id="discard-import-title" className="text-lg font-semibold text-slate-900">
          Discard this import?
        </h2>
        <p className="mt-3 text-sm text-slate-600">
          This will permanently remove the uploaded spreadsheet, import rows, draft links, and
          import logs.
        </p>
        <p className="mt-3 text-sm text-slate-600">
          Companies created during import and live event exhibitors will NOT be deleted.
        </p>
        {error ? <p className={`mt-3 ${feedbackErrorClass}`}>{error}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirm} disabled={loading}>
            {loading ? "Discarding…" : "Discard import"}
          </Button>
        </div>
      </div>
    </div>
  );
}
