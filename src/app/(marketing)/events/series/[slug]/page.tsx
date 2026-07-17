import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { SeriesEditionsList } from "@/src/features/events/components/series/SeriesEditionsList";
import { SeriesHubHeader } from "@/src/features/events/components/series/SeriesHubHeader";
import { getSeriesHubData } from "@/src/features/events/server/getSeriesHubData";
import { buildEventSeriesSummary } from "@/src/lib/content/factualSummary";
import { brandLinkClass } from "@/src/lib/design/classes";
import {
  createNotFoundPageMetadata,
  createPageMetadata,
} from "@/src/lib/metadata/site";
import { robotsForIndexability } from "@/src/lib/seo/indexability";
import { resolveSeriesPublicAccess } from "@/src/lib/seo/resolveSeriesPublicAccess";

export const dynamic = "force-dynamic";

type SeriesHubPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: SeriesHubPageProps): Promise<Metadata> {
  const { slug } = await params;
  const access = await resolveSeriesPublicAccess(slug);
  if (!access) {
    return createNotFoundPageMetadata(`/events/series/${slug}`);
  }

  if (access.kind === "redirect") {
    return createPageMetadata({
      title: access.fromSeries.name,
      description: `${access.fromSeries.name} — all events and editions on EventPixels.`,
      path: `/events/series/${access.fromSeries.slug}`,
      robots: robotsForIndexability(access.indexability),
    });
  }

  const series = access.series;
  const description =
    series.description?.trim() ||
    `${series.name} — all events and editions on EventPixels.`;

  return createPageMetadata({
    title: series.name,
    description,
    path: `/events/series/${series.slug}`,
    robots: robotsForIndexability(access.indexability),
  });
}

export default async function SeriesHubPage({ params }: SeriesHubPageProps) {
  const { slug } = await params;
  const access = await resolveSeriesPublicAccess(slug);

  if (!access) {
    notFound();
  }

  if (access.kind === "redirect") {
    permanentRedirect(access.path);
  }

  if (access.kind === "tombstone") {
    return (
      <section className="space-y-6">
        <Link href="/events" className={`text-sm ${brandLinkClass}`}>
          ← Back to Events
        </Link>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">
            Event brand unavailable
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            This event brand has been merged and no longer has a public
            destination.
          </p>
        </div>
      </section>
    );
  }

  const data = await getSeriesHubData(slug);
  if (!data) {
    notFound();
  }

  const factualSummary = buildEventSeriesSummary({
    name: data.series.name,
    lifecycleStatus: data.series.lifecycle_status,
    editions: data.editions.map((edition) => ({
      name: edition.name,
      year: edition.year,
      startDate: edition.start_date,
      endDate: edition.end_date,
      locationLabel: edition.locationLabel,
    })),
    topics: data.topics.map((topic) => topic.name),
  });

  return (
    <section className="space-y-6">
      <Link href="/events" className={`text-sm ${brandLinkClass}`}>
        ← Back to Events
      </Link>

      <SeriesHubHeader
        series={data.series}
        topics={data.topics}
        factualSummary={factualSummary}
      />
      <SeriesEditionsList editions={data.editions} />
    </section>
  );
}
