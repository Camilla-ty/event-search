import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/src/components/common";
import { EventSponsorsSection } from "@/src/features/events/components/detail/EventSponsorsSection";
import {
  filterDisplayableSponsors,
} from "@/src/features/events/components/detail/eventSponsorUtils";
import type { EventSponsorRow } from "@/src/features/events/components/detail/types";
import { getEventDetailData } from "@/src/features/events/server/getEventDetailData";
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
        <Link
          href="/events"
          className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
        >
          ← Back to Events Explorer
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-200 dark:border-slate-800 dark:bg-slate-800">
          <div className="aspect-[16/9] w-full bg-gradient-to-br from-violet-700 to-indigo-500" />
        </div>

        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="space-y-2">
            <Badge variant="neutral">{edition.event_series?.name ?? "Event"}</Badge>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {edition.name}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {edition.cities?.name ?? "Unknown city"}
              {edition.cities?.countries?.name ? `, ${edition.cities.countries.name}` : ""}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {formatDateRange(edition.start_date, edition.end_date)}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">Sponsors</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {sponsorCount}
                {!isAuthenticated ? "+" : ""}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">Year</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {edition.year ?? "TBC"}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">Category</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {edition.event_series?.name ?? "General"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Description</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {edition.event_series?.description ??
            "Detailed event description will be expanded as the content model evolves."}
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <EventSponsorsSection
          sponsors={sponsors}
          isAuthenticated={isAuthenticated}
        />

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Actions</h2>
          <div className="mt-3 space-y-2">
            <Link
              href={`/sponsors?event=${eventSlug}`}
              className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-violet-600 px-4 text-sm font-medium text-white hover:bg-violet-500"
            >
              View Sponsors
            </Link>
            <Link
              href="/events"
              className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Back to Explorer
            </Link>
          </div>
        </div>
      </section>
    </section>
  );
}
