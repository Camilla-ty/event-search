import Link from "next/link";

import type { EventRecord } from "@/src/features/events/components/explorer/types";
import { buildEventDetailPath } from "@/src/lib/routes/explorerUrls";

type EventCalendarEventChipProps = {
  event: EventRecord;
};

const chipClass =
  "block truncate rounded border border-brand-primary/20 bg-brand-primary-muted px-1.5 py-0.5 text-xs font-medium text-brand-primary transition hover:border-brand-primary/40 hover:bg-brand-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30";

export function EventCalendarEventChip({ event }: EventCalendarEventChipProps) {
  const href = buildEventDetailPath(event);
  const label = event.name?.trim() || "Untitled Event";

  if (href === null) {
    return <span className={chipClass}>{label}</span>;
  }

  return (
    <Link href={href} className={chipClass} title={label}>
      {label}
    </Link>
  );
}
