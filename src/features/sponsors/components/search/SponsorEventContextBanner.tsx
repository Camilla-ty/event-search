"use client";

import { brandLinkClass } from "@/src/lib/design/classes";

type SponsorEventContextBannerProps = {
  eventName: string | null;
  eventSlug: string;
  eventUnknown?: boolean;
  onClear: () => void;
};

export function SponsorEventContextBanner({
  eventName,
  eventSlug,
  eventUnknown = false,
  onClear,
}: SponsorEventContextBannerProps) {
  const slugLabel = eventSlug.trim() !== "" ? eventSlug.trim() : "this event";

  if (eventUnknown) {
    return (
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm"
        role="status"
      >
        <p className="text-amber-950">
          <span className="font-medium">Unknown event edition:</span>{" "}
          <span className="font-medium">{slugLabel}</span>. No sponsors match this filter.
        </p>
        <button type="button" onClick={onClear} className={brandLinkClass}>
          Clear event filter
        </button>
      </div>
    );
  }

  const label = eventName?.trim() ? eventName.trim() : slugLabel;

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-primary/25 bg-brand-primary-muted px-4 py-3 text-sm"
      role="status"
    >
      <p className="text-slate-700">
        <span className="font-medium text-slate-900">Filtered by event:</span> Showing sponsors
        for <span className="font-medium text-slate-900">{label}</span>
      </p>
      <button type="button" onClick={onClear} className={brandLinkClass}>
        Clear event filter
      </button>
    </div>
  );
}
