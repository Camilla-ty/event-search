"use client";

import { useState } from "react";

import { Button } from "@/src/components/common";
import { feedbackErrorClass } from "@/src/lib/design/classes";

import type { LiveSponsorRow } from "./liveSponsorTypes";

type RemoveSponsorModalProps = {
  row: LiveSponsorRow;
  editionName: string;
  editionYear: number;
  onClose: () => void;
  onRemoved: () => void;
};

export function RemoveSponsorModal({
  row,
  editionName,
  editionYear,
  onClose,
  onRemoved,
}: RemoveSponsorModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const companyName = row.companies?.name ?? "This company";
  const isPubliclyVisible = row.tier_rank === 1;

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/event-sponsors/${row.id}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to remove sponsor.");
        setLoading(false);
        return;
      }
      onRemoved();
    } catch {
      setError("Failed to remove sponsor.");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-sponsor-title"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg"
      >
        <h2 id="remove-sponsor-title" className="text-lg font-semibold text-slate-900">
          Remove sponsor from this edition?
        </h2>
        <p className="mt-3 text-sm text-slate-600">
          <span className="font-medium text-slate-900">{companyName}</span> will be
          removed from{" "}
          <span className="font-medium text-slate-900">
            {editionName} ({editionYear})
          </span>
          . The company itself is not deleted and remains available in Companies.
        </p>
        {isPubliclyVisible ? (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
            This sponsor is currently rank 1 and visible to logged-out visitors.
            Removing it changes the public page immediately.
          </p>
        ) : null}
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
