"use client";

import { Button } from "@/src/components/common";
import { secondaryCtaClass } from "@/src/lib/design/classes";

export type LiveSponsorOrderSaveBarState = "unsaved" | "saving" | "saved" | "error";

type LiveSponsorOrderSaveBarProps = {
  state: LiveSponsorOrderSaveBarState;
  errorMessage?: string | null;
  onSave: () => void;
  onReset: () => void;
};

const BAR_SURFACE: Record<LiveSponsorOrderSaveBarState, string> = {
  unsaved: "border-amber-200 bg-amber-50",
  saving: "border-amber-200 bg-amber-50",
  saved: "border-emerald-200 bg-emerald-50",
  error: "border-red-200 bg-red-50",
};

function statusMessage(state: LiveSponsorOrderSaveBarState, errorMessage: string | null): string {
  switch (state) {
    case "saving":
      return "Saving order…";
    case "saved":
      return "Order saved";
    case "error":
      return errorMessage ?? "Failed to save order.";
    case "unsaved":
      return "Order modified · Unsaved changes";
  }
}

function statusTextClass(state: LiveSponsorOrderSaveBarState): string {
  switch (state) {
    case "saved":
      return "text-emerald-950";
    case "error":
      return "text-red-950";
    default:
      return "text-amber-950";
  }
}

export function LiveSponsorOrderSaveBar({
  state,
  errorMessage = null,
  onSave,
  onReset,
}: LiveSponsorOrderSaveBarProps) {
  const showActions = state === "unsaved" || state === "saving" || state === "error";
  const message = statusMessage(state, errorMessage);

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${BAR_SURFACE[state]}`}
      role="status"
      aria-live="polite"
    >
      <p className={`text-sm font-medium ${statusTextClass(state)}`}>{message}</p>
      {showActions ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={state === "saving"} onClick={onSave}>
            Save order
          </Button>
          <button
            type="button"
            disabled={state === "saving"}
            onClick={onReset}
            className={`${secondaryCtaClass} h-10 disabled:cursor-not-allowed disabled:opacity-50`}
          >
            Reset
          </button>
        </div>
      ) : null}
    </div>
  );
}

type LiveSponsorOrderSaveFooterProps = {
  visible: boolean;
  state: LiveSponsorOrderSaveBarState;
  errorMessage?: string | null;
  onSave: () => void;
  onReset: () => void;
};

/** Fixed bottom footer so save actions stay visible on long sponsor rosters. */
export function LiveSponsorOrderSaveFooter({
  visible,
  state,
  errorMessage = null,
  onSave,
  onReset,
}: LiveSponsorOrderSaveFooterProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur-sm">
      <div className="pointer-events-auto mx-auto w-full max-w-6xl">
        <LiveSponsorOrderSaveBar
          state={state}
          errorMessage={errorMessage}
          onSave={onSave}
          onReset={onReset}
        />
      </div>
    </div>
  );
}
