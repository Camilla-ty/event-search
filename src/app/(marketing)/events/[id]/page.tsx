import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/src/components/common";
import { EventSponsorsSection } from "@/src/features/events/components/detail/EventSponsorsSection";
import { filterDisplayableSponsors } from "@/src/features/events/components/detail/eventSponsorUtils";
import type { EventSponsorRow } from "@/src/features/events/components/detail/types";
import { getEventDetailData } from "@/src/features/events/server/getEventDetailData";
import { brandLinkClass, primaryCtaClass, secondaryCtaClass } from "@/src/lib/design/classes";
import { createPageMetadata } from "@/src/lib/metadata/site";
import { createClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";

type EventDetailPageProps = {
  params: Promise<{ id: string }>;
};

function formatDateRange(start?: string | null, end?: string | null) {
  if (!start && !end) return "Date TBC";
  if (!start) return end ?? "Date TBC";
  if (!end || end === start) return start;
  return `${start} - ${end}`;
}

export async function generateMetadata({
  params,
}: EventDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const edition = await getEventDetailData(id);
  if (!edition) {
    return createPageMetadata({ title: "Event not found", path: `/events/${id}` });
  }
  const name = edition.name?.trim() || "Event";
  const city = edition.cities?.name;
  const country = edition.cities?.countries?.name;
  const location = [city, country].filter(Boolean).join(", ");
  const description = location
    ? `${name} — ${location}. View sponsors and event intelligence on Event Pixels.`
    : `${name}. View sponsors and event intelligence on Event Pixels.`;
  const slug = typeof edition.slug === "string" ? edition.slug : id;
  return createPageMetadata({
    title: name,
    description,
    path: `/events/${slug}`,
  });
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const edition = await getEventDetailData(id);

  if (!edition) {
    notFound();
  }

  const sponsors = filterDisplayableSponsors(
    (edition.event_sponsors ?? []) as EventSponsorRow[],
  );
  const isAuthenticated = user !== null;
  const sponsorCount = sponsors.length;
  const eventSlug = typeof edition.slug === "string" ? edition.slug : "";

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/events" className={`text-sm ${brandLinkClass}`}>
          ← Back to Events Explorer
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,340px)_1fr] lg:grid-cols-[minmax(0,380px)_1fr]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-brand-primary-muted">
          <div className="aspect-[16/9] w-full bg-gradient-to-br from-brand-primary to-brand-primary-hover" />
        </div>

        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="space-y-2">
            <Badge variant="neutral">{edition.event_series?.name ?? "Event"}</Badge>
            <h1 className="text-2xl font-semibold text-slate-900">{edition.name}</h1>
            <p className="text-sm text-slate-600">
              {edition.cities?.name ?? "Unknown city"}
              {edition.cities?.countries?.name ? `, ${edition.cities.countries.name}` : ""}
            </p>
            <p className="text-sm text-slate-500">
              {formatDateRange(edition.start_date, edition.end_date)}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Sponsors</p>
              <p className="text-lg font-semibold text-slate-900">{sponsorCount}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Year</p>
              <p className="text-lg font-semibold text-slate-900">{edition.year ?? "TBC"}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Category</p>
              <p className="text-lg font-semibold text-slate-900">
                {edition.event_series?.name ?? "General"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Description</h2>
        <p className="mt-2 text-sm text-slate-600">
          {edition.event_series?.description ??
            "Detailed event description will be expanded as the content model evolves."}
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <EventSponsorsSection
          sponsors={sponsors}
          isAuthenticated={isAuthenticated}
          eventSlug={eventSlug}
        />

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Actions</h2>
          <div className="mt-3 space-y-2">
            <Link
              href={`/sponsors?event=${eventSlug}`}
              className={`${primaryCtaClass} h-10 w-full`}
            >
              View Sponsors
            </Link>
            <Link href="/events" className={`${secondaryCtaClass} h-10 w-full`}>
              Back to Explorer
            </Link>
          </div>
        </div>
      </section>
    </section>
  );
}
