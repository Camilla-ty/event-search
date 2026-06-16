"use client";

import { InlineErrorBanner } from "@/src/components/common";

type BrandfetchUpgradeBatchResultsProps = {
  upgraded: number;
  skipped: number;
  failed: number;
  error?: string | null;
  onDismiss?: () => void;
};

export function BrandfetchUpgradeBatchResults({
  upgraded,
  skipped,
  failed,
  error,
  onDismiss,
}: BrandfetchUpgradeBatchResultsProps) {
  if (error) {
    return <InlineErrorBanner message={error} variant="error" />;
  }

  const variant = failed > 0 ? "warning" : "success";
  const message = `Brandfetch upgrade complete: ${upgraded} upgraded, ${skipped} skipped, ${failed} failed.`;

  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <InlineErrorBanner message={message} variant={variant} className="flex-1" />
      {onDismiss ? (
        <button
          type="button"
          className="shrink-0 text-sm text-slate-600 hover:text-slate-900"
          onClick={onDismiss}
        >
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
