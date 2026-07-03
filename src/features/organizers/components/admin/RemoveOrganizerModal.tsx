"use client";

import { useState } from "react";

import { Button } from "@/src/components/common";
import { feedbackErrorClass } from "@/src/lib/design/classes";

import type { EditionOrganizerAdminRow } from "@/src/features/organizers/server/eventOrganizerAdmin";

type RemoveOrganizerModalProps = {
  editionId: string;
  row: EditionOrganizerAdminRow;
  editionName: string;
  editionYear: number;
  onClose: () => void;
  onRemoved: () => void;
};

export function RemoveOrganizerModal({
  editionId,
  row,
  editionName,
  editionYear,
  onClose,
  onRemoved,
}: RemoveOrganizerModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const companyName = row.companies?.name ?? "This company";

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/event-editions/${editionId}/organizers/${row.id}`,
        { method: "DELETE" },
      );
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to remove organizer.");
        setLoading(false);
        return;
      }
      onRemoved();
    } catch {
      setError("Failed to remove organizer.");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-organizer-title"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg"
      >
        <h2 id="remove-organizer-title" className="text-lg font-semibold text-slate-900">
          Remove organizer from this edition?
        </h2>
        <p className="mt-3 text-sm text-slate-600">
          <span className="font-medium text-slate-900">{companyName}</span> will be removed as an
          organizer from{" "}
          <span className="font-medium text-slate-900">
            {editionName} ({editionYear})
          </span>
          . The company itself is not deleted.
        </p>
        {error ? <p className={`mt-3 ${feedbackErrorClass}`}>{error}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className="!bg-red-600 hover:!bg-red-700 focus-visible:!ring-red-300"
            onClick={() => void handleConfirm()}
            disabled={loading}
          >
            {loading ? "Removing…" : "Remove from edition"}
          </Button>
        </div>
      </div>
    </div>
  );
}
