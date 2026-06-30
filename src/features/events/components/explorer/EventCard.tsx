"use client";

import Link from "next/link";

import { Badge } from "@/src/components/common";
import { SeriesLogo } from "@/src/features/events/components/SeriesLogo";
import { buildEventCardKeywordPreview } from "@/src/features/events/lib/eventCardKeywordPreview";
import { buildEventDetailPath } from "@/src/lib/routes/explorerUrls";

import { formatLocationLabel } from "@/src/lib/location/formatLocationLabel";

import type { EventRecord } from "./types";

const cardSurfaceClass =
  "rounded-xl border border-slate-200 bg-white p-4 shadow-sm";

const cardInteractiveClass = [
  cardSurfaceClass,
  "block cursor-pointer transition",
  "hover:border-brand-primary/40 hover:bg-brand-primary-muted/30",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 focus-visible:ring-offset-2",
].join(" ");

function formatDateRange(start?: string | null, end?: string | null) {
  if (!start && !end) return "Date TBC";
  if (!start) return end ?? "Date TBC";
  if (!end || end === start) return start;
  return `${start} - ${end}`;
}

function formatSponsorCount(count: number): string {
  if (count === 1) return "1 Sponsor";
  return `${count} Sponsors`;
}

type EventCardContentProps = {
  event: EventRecord;
  location: string;
  keywordPreview: ReturnType<typeof buildEventCardKeywordPreview>;
};

function EventCardContent({ event, location, keywordPreview }: EventCardContentProps) {
  return (
    <div className="flex items-start gap-3">
      <SeriesLogo
        series={event.event_series}
        fallbackName={event.name}
        className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
        monogramClassName="text-base font-semibold text-slate-400"
      />
      <div className="min-w-0 space-y-2">
        <h3 className="line-clamp-1 text-base font-semibold text-slate-900">
          {event.name ?? "Untitled Event"}
        </h3>
        <p className="text-sm text-slate-600">
          {formatSponsorCount(event.sponsor_count ?? 0)}
        </p>
        {keywordPreview ? (
          <div className="flex flex-wrap gap-1.5">
            {keywordPreview.visibleKeywords.map((keyword) => (
              <Badge
                key={keyword.key}
                variant="neutral"
                className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
              >
                {keyword.label}
              </Badge>
            ))}
            {keywordPreview.overflowCount > 0 ? (
              <Badge
                variant="neutral"
                className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
              >
                +{keywordPreview.overflowCount}
              </Badge>
            ) : null}
          </div>
        ) : null}
        <p className="text-xs text-slate-500">
          {formatDateRange(event.start_date, event.end_date)}
        </p>
        <p className="line-clamp-1 text-sm text-slate-600">
          {location || "Location not set"}
        </p>
      </div>
    </div>
  );
}

export function EventCard({ event }: { event: EventRecord }) {
  const location = formatLocationLabel({
    city: event.cities?.name,
    state: event.cities?.states?.name,
    country: event.cities?.countries?.name,
  });
  const keywordPreview = buildEventCardKeywordPreview(event.series_keywords);
  const href = buildEventDetailPath(event);
  const eventName = event.name?.trim() || "Untitled Event";
  const contentProps = { event, location, keywordPreview };

  if (!href) {
    return (
      <article className={cardSurfaceClass}>
        <EventCardContent {...contentProps} />
      </article>
    );
  }

  return (
    <Link href={href} className={cardInteractiveClass} aria-label={`View ${eventName}`}>
      <EventCardContent {...contentProps} />
    </Link>
  );
}
