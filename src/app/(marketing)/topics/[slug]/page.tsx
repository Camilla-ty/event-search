import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { TopicEditionsList } from "@/src/features/events/components/topic/TopicEditionsList";
import { TopicHubHeader } from "@/src/features/events/components/topic/TopicHubHeader";
import { TopicSeriesList } from "@/src/features/events/components/topic/TopicSeriesList";
import { getTopicHubData } from "@/src/features/events/server/topicHubPublic";
import { brandLinkClass } from "@/src/lib/design/classes";
import {
  createNotFoundPageMetadata,
  createPageMetadata,
} from "@/src/lib/metadata/site";
import { buildTopicHubPath } from "@/src/lib/routes/explorerUrls";
import {
  getTopicIndexability,
  robotsForIndexability,
} from "@/src/lib/seo/indexability";

export const dynamic = "force-dynamic";

type TopicHubPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: TopicHubPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getTopicHubData(slug);
  if (!data) {
    return createNotFoundPageMetadata(
      buildTopicHubPath(slug) ?? `/topics/${slug}`,
    );
  }

  const decision = getTopicIndexability();
  return createPageMetadata({
    title: data.topic.name,
    description: `${data.topic.name} — related event brands and editions on EventPixels.`,
    path: buildTopicHubPath(data.topic.slug) ?? `/topics/${data.topic.slug}`,
    robots: robotsForIndexability(decision),
  });
}

export default async function TopicHubPage({ params }: TopicHubPageProps) {
  const { slug } = await params;
  const data = await getTopicHubData(slug);

  if (!data) {
    notFound();
  }

  return (
    <section className="space-y-6">
      <Link href="/events" className={`text-sm ${brandLinkClass}`}>
        ← Back to Events
      </Link>

      <TopicHubHeader topic={data.topic} />
      <TopicSeriesList series={data.series} />
      <TopicEditionsList editions={data.editions} />
    </section>
  );
}
