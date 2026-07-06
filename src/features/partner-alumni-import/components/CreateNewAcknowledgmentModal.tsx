"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/src/components/common";
import { feedbackErrorClass, secondaryCtaClass } from "@/src/lib/design/classes";

type CreateNewAcknowledgmentModalProps = {
  open: boolean;
  count: number;
  totalRows: number;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
};

export function CreateNewAcknowledgmentModal({
  open,
  count,
  totalRows,
  loading,
  error,
  onClose,
  onConfirm,
}: CreateNewAcknowledgmentModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (open) {
      setChecked(false);
      cancelRef.current?.focus();
    }
  }, [open]);

  if (!open) return null;

  const pct = totalRows > 0 ? Math.round((count / totalRows) * 100) : 0;
  const highVolume = totalRows > 0 && count / totalRows > 0.1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="create-new-ack-title"
        className="w-full max-w-lg rounded-xl border-2 border-rose-400 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="create-new-ack-title" className="text-xl font-bold text-rose-950">
          Confirm new company creation
        </h2>
        <div className="mt-4 rounded-xl border-2 border-rose-300 bg-rose-50 px-6 py-5 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-rose-800">
            This import will create
          </p>
          <p className="mt-1 text-5xl font-bold tabular-nums text-rose-950">{count}</p>
          <p className="mt-1 text-sm font-medium text-rose-900">
            new compan{count === 1 ? "y" : "ies"} in the catalog
          </p>
        </div>
        {highVolume ? (
          <p className="mt-4 text-sm font-medium text-amber-900">
            Warning: {count} create-new rows is {pct}% of this file ({totalRows} rows). Double-check
            column mapping and review decisions before continuing.
          </p>
        ) : null}
        <p className="mt-4 text-sm text-slate-700">
          New companies are permanent catalog records. This acknowledgment is logged for audit.
        </p>
        <label className="mt-4 flex items-start gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-1"
          />
          <span>
            I understand this import will create{" "}
            <span className="font-bold text-rose-900">{count}</span> new{" "}
            {count === 1 ? "company" : "companies"} and I have reviewed every create-new row.
          </span>
        </label>
        {loading ? (
          <p className="mt-3 text-sm text-slate-600" role="status" aria-live="polite">
            Saving acknowledgment…
          </p>
        ) : null}
        {error ? <p className={`mt-3 ${feedbackErrorClass}`}>{error}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            className={`${secondaryCtaClass} h-9 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50`}
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <Button type="button" onClick={onConfirm} disabled={!checked || loading}>
            Acknowledge and continue
          </Button>
        </div>
      </div>
    </div>
  );
}
