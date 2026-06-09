"use client";

import { useState } from "react";

import { Button } from "@/src/components/common";
import { formInputClass } from "@/src/lib/design/classes";

type SlugChangeModalProps = {
  entityLabel: string;
  oldSlug: string;
  newSlug: string;
  publicPathPrefix: string;
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function SlugChangeModal({
  entityLabel,
  oldSlug,
  newSlug,
  publicPathPrefix,
  open,
  onCancel,
  onConfirm,
}: SlugChangeModalProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="slug-change-title"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
        <h2 id="slug-change-title" className="text-lg font-semibold text-slate-900">
          Confirm {entityLabel} slug change
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Changing the slug breaks existing links to this {entityLabel.toLowerCase()}.
          Bookmarks and external references may fail.
        </p>
        <div className="mt-4 space-y-2 rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-700">
          <p>
            <span className="text-slate-500">Old:</span> {publicPathPrefix}
            {oldSlug}
          </p>
          <p>
            <span className="text-slate-500">New:</span> {publicPathPrefix}
            {newSlug}
          </p>
        </div>
        <label className="mt-4 flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            className={formInputClass}
          />
          <span>I understand this may break existing URLs.</span>
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" disabled={!acknowledged} onClick={onConfirm}>
            Save slug change
          </Button>
        </div>
      </div>
    </div>
  );
}
