"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/src/components/common/Button";
import { feedbackErrorClass, formInputClass, secondaryCtaClass } from "@/src/lib/design/classes";

const MERGE_CONFIRMATION = "MERGE";

type MergeConfirmDialogProps = {
  open: boolean;
  canonicalName: string;
  duplicateName: string;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (confirmation: string) => void;
};

export function MergeConfirmDialog({
  open,
  canonicalName,
  duplicateName,
  loading,
  error,
  onClose,
  onConfirm,
}: MergeConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    if (open) {
      setConfirmation("");
      cancelRef.current?.focus();
    }
  }, [open]);

  if (!open) return null;

  const canConfirm = confirmation === MERGE_CONFIRMATION && !loading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="merge-confirm-title"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="merge-confirm-title" className="text-lg font-semibold text-slate-900">
          Confirm company merge
        </h2>
        <p className="mt-3 text-sm text-slate-600">
          <span className="font-medium text-slate-900">{duplicateName}</span> will be
          soft-archived and merged into{" "}
          <span className="font-medium text-slate-900">{canonicalName}</span>. Sponsorships
          and import links will be repointed according to your chosen strategies.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>The duplicate company will no longer appear in admin search.</li>
          <li>The duplicate name will be added as an alias on the canonical company.</li>
          <li>This action cannot be undone from the admin UI.</li>
        </ul>
        <label className="mt-4 block space-y-1 text-sm">
          <span className="font-medium text-slate-700">
            Type <span className="font-mono">{MERGE_CONFIRMATION}</span> to confirm
          </span>
          <input
            type="text"
            className={formInputClass}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            disabled={loading}
          />
        </label>
        {loading ? (
          <p className="mt-3 text-sm text-slate-600" role="status" aria-live="polite">
            Merging companies…
          </p>
        ) : null}
        {error ? <p className={`mt-3 ${feedbackErrorClass}`}>{error}</p> : null}
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
          <Button
            type="button"
            className="!bg-red-600 hover:!bg-red-700 focus-visible:!ring-red-300"
            disabled={!canConfirm}
            onClick={() => onConfirm(confirmation)}
          >
            {loading ? "Merging…" : "Merge companies"}
          </Button>
        </div>
      </div>
    </div>
  );
}
