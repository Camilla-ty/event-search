import type { ReactNode } from "react";
import Link from "next/link";

import {
  buildEventHistoryRows,
  type MergedIntoSeriesDestination,
} from "@/src/features/events/components/detail/eventHistoryDisplay";
import { brandLinkClass } from "@/src/lib/design/classes";

type EventHistorySectionProps = {
  lifecycleStatus: string | null | undefined;
  mergedIntoSeries?: MergedIntoSeriesDestination | null;
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
  mergedIntoSeries = null,
}: EventHistorySectionProps) {
  const rows = buildEventHistoryRows({
    lifecycleStatus,
    mergedIntoSeries,
  });

  if (!rows) {
    return null;
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Event History</h2>
      <dl className="mt-3 space-y-3">
        {rows.map((row) => {
          if (row.kind === "status") {
            return (
              <MetadataRow key="status" label={row.label}>
                {row.value}
              </MetadataRow>
            );
          }

          return (
            <MetadataRow key="merged_into" label={row.label}>
              <Link href={row.destinationHref} className={brandLinkClass}>
                {row.destinationName}
              </Link>
            </MetadataRow>
          );
        })}
      </dl>
    </section>
  );
}
