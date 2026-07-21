"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/src/components/common";
import { SeriesLogo } from "@/src/features/events/components/SeriesLogo";
import type { EventCardKeywordPreview } from "@/src/features/events/lib/eventCardKeywordPreview";
import { formatEventDateRange } from "@/src/features/events/lib/formatEventDateRange";

export type EventCardSeries = {
  name: string | null;
  logo_url: string | null;
};

export type EventCardModel = {
  id: string;
  name: string;
  href: string | null;
  startDate: string | null;
  endDate: string | null;
  locationLabel: string;
  series: EventCardSeries | null;
  sponsorCount: number;
  topicPreview: EventCardKeywordPreview | null;
};

const cardSurfaceClass =
  "rounded-xl border border-slate-200 bg-white p-4 shadow-sm";

const cardInteractiveClass = [
  cardSurfaceClass,
  "block cursor-pointer transition",
  "hover:border-brand-primary/40 hover:bg-brand-primary-muted/30",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 focus-visible:ring-offset-2",
].join(" ");

function EventCardSponsorCount({ count }: { count: number }) {
  const value = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
  const label = value === 1 ? "Sponsor" : "Sponsors";

  return (
    <span>
      <span className="font-semibold text-slate-800">{value.toLocaleString()}</span>
      <span className="text-slate-500"> {label}</span>
    </span>
  );
}

type EventCardKeywordBadgesProps = {
  keywordPreview: EventCardKeywordPreview;
};

function EventCardKeywordBadges({ keywordPreview }: EventCardKeywordBadgesProps) {
  return (
    <div className="flex flex-wrap gap-1.5 md:max-w-[45%] md:justify-end lg:max-w-[50%]">
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
  );
}

type EventCardMetaBlockProps = {
  children: ReactNode;
  withDivider?: boolean;
};

function EventCardMetaBlock({ children, withDivider = false }: EventCardMetaBlockProps) {
  return (
    <div
      className={`min-w-0 text-sm text-slate-600 md:flex-1 ${
        withDivider ? "md:border-l md:border-slate-200 md:px-4" : "md:pr-4"
      }`}
    >
      {children}
    </div>
  );
}

function EventCardContent({ event }: { event: EventCardModel }) {
  const dateLabel = formatEventDateRange(event.startDate, event.endDate);
  const locationLabel = event.locationLabel || "Location not set";

  return (
    <div className="flex items-start gap-4">
      <SeriesLogo
        series={event.series}
        fallbackName={event.name}
        className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
        monogramClassName="text-lg font-semibold text-slate-400"
      />
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-3">
          <h3 className="line-clamp-2 min-w-0 flex-1 text-base font-semibold leading-snug text-slate-900">
            {event.name}
          </h3>
          {event.topicPreview ? (
            <EventCardKeywordBadges keywordPreview={event.topicPreview} />
          ) : null}
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <EventCardMetaBlock>
            <EventCardSponsorCount count={event.sponsorCount} />
          </EventCardMetaBlock>
          <EventCardMetaBlock withDivider>{dateLabel}</EventCardMetaBlock>
          <EventCardMetaBlock withDivider>
            <span className="line-clamp-2">{locationLabel}</span>
          </EventCardMetaBlock>
        </div>
      </div>
    </div>
  );
}

export type EventCardProps = {
  event: EventCardModel;
};

export function EventCard({ event }: EventCardProps) {
  if (!event.href) {
    return (
      <article className={cardSurfaceClass}>
        <EventCardContent event={event} />
      </article>
    );
  }

  return (
    <Link
      href={event.href}
      prefetch={false}
      className={cardInteractiveClass}
      aria-label={`View ${event.name}`}
    >
      <EventCardContent event={event} />
    </Link>
  );
}
