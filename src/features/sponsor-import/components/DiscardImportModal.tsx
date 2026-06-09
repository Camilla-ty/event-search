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
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    const result = await discardBatch(batchId, reason.trim() || undefined);
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
          Discard import?
        </h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>Draft sponsor links for this import will be removed.</li>
          <li>Companies created or matched during this import will not be deleted.</li>
          <li>Live sponsors already published are not affected.</li>
        </ul>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          Reason (optional)
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
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
