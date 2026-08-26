import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TopicRegionHubView } from "@/src/features/events/components/topic-region/TopicRegionHubView";
import { getTopicRegionHubPageData } from "@/src/features/events/server/topicRegionHubData";
import { formatResearchPagePublicPath } from "@/src/features/research-pages/lib/formatResearchPagePublicPath";
import { getPublishedResearchPageBySlugsPublic } from "@/src/features/research-pages/server/researchPagesPublic";
import {
  createNotFoundPageMetadata,
  createPageMetadata,
} from "@/src/lib/metadata/site";
import {
  getTopicRegionHubIndexability,
  robotsForIndexability,
} from "@/src/lib/seo/indexability";

export const dynamic = "force-dynamic";

type Params = { topicSlug: string; regionSlug: string };

async function loadPublishedPage(params: Params) {
  const location = { type: "region" as const, slug: params.regionSlug };

  const published = await getPublishedResearchPageBySlugsPublic(
    params.topicSlug,
    location,
    null,
  );
  if (!published) return null;

  return getTopicRegionHubPageData(params.topicSlug, location, null);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { topicSlug, regionSlug } = await params;
  const data = await loadPublishedPage({ topicSlug, regionSlug });

  if (!data) {
    return createNotFoundPageMetadata(
      formatResearchPagePublicPath(topicSlug, {
        type: "region",
        slug: regionSlug,
      }),
    );
  }

  const indexability = getTopicRegionHubIndexability(data.facts);

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
