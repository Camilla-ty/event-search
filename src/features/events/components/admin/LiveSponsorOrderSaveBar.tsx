"use client";

import { Button } from "@/src/components/common";
import { secondaryCtaClass } from "@/src/lib/design/classes";

type LiveSponsorOrderSaveBarProps = {
  isSaving: boolean;
  onSave: () => void;
  onReset: () => void;
};

export function LiveSponsorOrderSaveBar({
  isSaving,
  onSave,
  onReset,
}: LiveSponsorOrderSaveBarProps) {
  return (
    <div
      className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      role="status"
      aria-live="polite"
    >
      <p className="text-sm font-medium text-amber-950">
        Order modified · Unsaved changes
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={isSaving} onClick={onSave}>
          {isSaving ? "Saving order…" : "Save order"}
        </Button>
        <button
          type="button"
          disabled={isSaving}
          onClick={onReset}
          className={`${secondaryCtaClass} h-10 disabled:cursor-not-allowed disabled:opacity-50`}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
