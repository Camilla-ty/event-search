import type { ReactNode } from "react";

import { formatEventLifecycleStatusLabel } from "@/src/lib/validation/eventLifecycleStatus";

type EventHistorySectionProps = {
  lifecycleStatus: string | null | undefined;
  lifecycleNote: string | null | undefined;
};

function MetadataRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="shrink-0 text-sm font-medium text-slate-700 sm:w-36">{label}</dt>
      <dd className="text-sm text-slate-600">{children}</dd>
    </div>
  );
}

export function EventHistorySection({
  lifecycleStatus,
  lifecycleNote,
}: EventHistorySectionProps) {
  const statusLabel = formatEventLifecycleStatusLabel(lifecycleStatus);
  const note = lifecycleNote?.trim() ?? "";

  if (!statusLabel && note === "") {
    return null;
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Event History</h2>
      <dl className="mt-3 space-y-3">
        {statusLabel ? (
          <MetadataRow label="Status">{statusLabel}</MetadataRow>
        ) : null}
        {note !== "" ? <MetadataRow label="Lifecycle Note">{note}</MetadataRow> : null}
      </dl>
    </section>
  );
}
