import Link from "next/link";

import type { EventRecord } from "@/src/features/events/components/explorer/types";
import type { CalendarColorFamily } from "@/src/features/events/lib/eventCalendarColors";
import { buildEventDetailPath } from "@/src/lib/routes/explorerUrls";

type EventCalendarEventChipProps = {
  event: EventRecord;
  colorFamily?: CalendarColorFamily;
};

const chipBaseClass =
  "block truncate rounded border px-1.5 py-0.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2";

const chipColorClassByFamily: Record<CalendarColorFamily, string> = {
  Blue:
    "border-brand-primary/60 bg-brand-primary/5 text-slate-900 hover:border-brand-primary/70 hover:bg-brand-primary/10 focus-visible:ring-brand-primary/30",
  Green:
    "border-brand-success/50 bg-brand-success/10 text-slate-900 hover:border-brand-success/60 hover:bg-brand-success/15 focus-visible:ring-brand-success/30",
  Orange:
    "border-brand-warning/60 bg-brand-warning/10 text-slate-900 hover:border-brand-warning/70 hover:bg-brand-warning/15 focus-visible:ring-brand-warning/30",
  Purple:
    "border-brand-accent/50 bg-brand-accent/5 text-slate-900 hover:border-brand-accent/60 hover:bg-brand-accent/10 focus-visible:ring-brand-accent/30",
  Grey:
    "border-slate-400 bg-slate-50 text-slate-900 hover:border-slate-500 hover:bg-slate-100 focus-visible:ring-slate-300",
};

export function EventCalendarEventChip({
  event,
  colorFamily = "Blue",
}: EventCalendarEventChipProps) {
  const href = buildEventDetailPath(event);
  const label = event.name?.trim() || "Untitled Event";
  const chipClass = `${chipBaseClass} ${chipColorClassByFamily[colorFamily]}`;

  if (href === null) {
    return <span className={chipClass}>{label}</span>;
  }

  return (
    <Link href={href} className={chipClass} title={label}>
      {label}
    </Link>
  );
}
