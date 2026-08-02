import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TopicRegionHubView } from "@/src/features/events/components/topic-region/TopicRegionHubView";
import { getTopicRegionHubPageData } from "@/src/features/events/server/topicRegionHubData";
import { getPublishedResearchPageBySlugsPublic } from "@/src/features/research-pages/server/researchPagesPublic";
import {
  createNotFoundPageMetadata,
  createPageMetadata,
} from "@/src/lib/metadata/site";
import { robotsForIndexability, INDEXABLE, NOINDEX_FOLLOW } from "@/src/lib/seo/indexability";

export const dynamic = "force-dynamic";

type Params = { topicSlug: string; regionSlug: string };

async function loadPublishedPage(params: Params) {
  const published = await getPublishedResearchPageBySlugsPublic(
    params.topicSlug,
    params.regionSlug,
    null,
  );
  if (!published) return null;

  const data = await getTopicRegionHubPageData(
    params.topicSlug,
    params.regionSlug,
    null,
  );
  return data;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { topicSlug, regionSlug } = await params;
  const data = await loadPublishedPage({ topicSlug, regionSlug });

  if (!data) {
    return createNotFoundPageMetadata(`/events/topics/${topicSlug}/regions/${regionSlug}`);
  }

  const indexability = data.passesGate ? INDEXABLE : NOINDEX_FOLLOW;

  return createPageMetadata({
    title: data.title,
    description: data.metaDescription,
    path: data.path,
    robots: robotsForIndexability(indexability),
  });
}

export default async function TopicRegionHubPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { topicSlug, regionSlug } = await params;
  const data = await loadPublishedPage({ topicSlug, regionSlug });

  if (!data) {
    notFound();
  }

  return <TopicRegionHubView data={data} />;
}
