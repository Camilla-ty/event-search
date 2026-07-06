"use client";

import type { ReactNode } from "react";

import { Button } from "@/src/components/common";

type AdminDrawerShellProps = {
  title: string;
  saving: boolean;
  saveLabel?: string;
  saveDisabled?: boolean;
  showSave?: boolean;
  onClose: () => void;
  onSave?: () => void;
  children: ReactNode;
};

export function AdminDrawerShell({
  title,
  saving,
  saveLabel = "Save",
  saveDisabled = false,
  showSave = true,
  onClose,
  onSave,
  children,
}: AdminDrawerShellProps) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Close
          </Button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4 text-sm">{children}</div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          {showSave && onSave ? (
            <Button onClick={onSave} disabled={saving || saveDisabled}>
              {saving ? "Saving…" : saveLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
