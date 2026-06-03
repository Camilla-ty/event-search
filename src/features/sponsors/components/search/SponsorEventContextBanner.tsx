"use client";

import { brandLinkClass } from "@/src/lib/design/classes";

type SponsorEventContextBannerProps = {
  eventName: string | null;
  onClear: () => void;
};

export function SponsorEventContextBanner({
  eventName,
  onClear,
}: SponsorEventContextBannerProps) {
  const label = eventName?.trim() ? eventName.trim() : "this event";

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
        Show all sponsors
      </button>
    </div>
  );
}
