import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SeriesEditionsList } from "@/src/features/events/components/series/SeriesEditionsList";
import { SeriesHubHeader } from "@/src/features/events/components/series/SeriesHubHeader";
import { getSeriesHubData } from "@/src/features/events/server/getSeriesHubData";
import { brandLinkClass } from "@/src/lib/design/classes";
import { createPageMetadata } from "@/src/lib/metadata/site";

export const dynamic = "force-dynamic";

type SeriesHubPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: SeriesHubPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getSeriesHubData(slug);
  if (!data) {
    return createPageMetadata({
      title: "Event brand not found",
      path: `/events/series/${slug}`,
    });
  }

  const description =
    data.series.description?.trim() ||
    `${data.series.name} — all events and editions on EventPixels.`;

  return createPageMetadata({
    title: data.series.name,
    description,
    path: `/events/series/${data.series.slug}`,
  });
}

export default async function SeriesHubPage({ params }: SeriesHubPageProps) {
  const { slug } = await params;
  const data = await getSeriesHubData(slug);

  if (!data) {
    notFound();
  }

  return (
    <section className="space-y-6">
      <Link href="/events" className={`text-sm ${brandLinkClass}`}>
        ← Back to Events
      </Link>

      <SeriesHubHeader series={data.series} topics={data.topics} />
      <SeriesEditionsList editions={data.editions} />
    </section>
  );
}
