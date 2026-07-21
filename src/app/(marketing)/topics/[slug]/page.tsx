import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { TopicEditionsList } from "@/src/features/events/components/topic/TopicEditionsList";
import { TopicHubHeader } from "@/src/features/events/components/topic/TopicHubHeader";
import { TopicSeriesList } from "@/src/features/events/components/topic/TopicSeriesList";
import { BITCOIN_ASIA_HUB_PATH, BITCOIN_ASIA_TOPIC_SLUG } from "@/src/features/events/lib/bitcoinAsiaHub";
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
    description: `${data.topic.name} — related event brands and events on EventPixels.`,
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

  const showBitcoinAsiaLink =
    data.topic.slug.trim().toLowerCase() === BITCOIN_ASIA_TOPIC_SLUG;

  return (
    <section className="space-y-6">
      <Link href="/events" className={`text-sm ${brandLinkClass}`}>
        ← Back to Events
      </Link>

      <TopicHubHeader topic={data.topic} />

      {showBitcoinAsiaLink ? (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            By region
          </p>
          <p className="mt-2 text-sm text-slate-700">
            <Link href={BITCOIN_ASIA_HUB_PATH} className={brandLinkClass}>
              Bitcoin events in Asia →
            </Link>
          </p>
        </div>
      ) : null}

      <TopicSeriesList series={data.series} />
      <TopicEditionsList editions={data.editions} />
    </section>
  );
}
