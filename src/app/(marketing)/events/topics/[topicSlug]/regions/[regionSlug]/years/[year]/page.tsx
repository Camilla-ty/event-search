import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TopicRegionHubView } from "@/src/features/events/components/topic-region/TopicRegionHubView";
import { getTopicRegionHubPageData } from "@/src/features/events/server/topicRegionHubData";
import { formatResearchPagePublicPath } from "@/src/features/research-pages/lib/formatResearchPagePublicPath";
import { parseResearchPageYearParam } from "@/src/features/research-pages/lib/parseResearchPageYearParam";
import { getPublishedResearchPageBySlugsPublic } from "@/src/features/research-pages/server/researchPagesPublic";
import {
  createNotFoundPageMetadata,
  createPageMetadata,
} from "@/src/lib/metadata/site";
import { robotsForIndexability, INDEXABLE, NOINDEX_FOLLOW } from "@/src/lib/seo/indexability";

export const dynamic = "force-dynamic";

type Params = { topicSlug: string; regionSlug: string; year: string };

async function loadPublishedYearPage(params: {
  topicSlug: string;
  regionSlug: string;
  year: number;
}) {
  const published = await getPublishedResearchPageBySlugsPublic(
    params.topicSlug,
    params.regionSlug,
    params.year,
  );
  if (!published) return null;

  return getTopicRegionHubPageData(
    params.topicSlug,
    params.regionSlug,
    params.year,
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { topicSlug, regionSlug, year: yearRaw } = await params;
  const year = parseResearchPageYearParam(yearRaw);

  if (year === null) {
    return createNotFoundPageMetadata(
      formatResearchPagePublicPath(topicSlug, regionSlug, null),
    );
  }

  const data = await loadPublishedYearPage({ topicSlug, regionSlug, year });
  if (!data) {
    return createNotFoundPageMetadata(
      formatResearchPagePublicPath(topicSlug, regionSlug, year),
    );
  }

  const indexability = data.passesGate ? INDEXABLE : NOINDEX_FOLLOW;

  return createPageMetadata({
    title: data.title,
    description: data.metaDescription,
    path: data.path,
    robots: robotsForIndexability(indexability),
  });
}

export default async function TopicRegionYearHubPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { topicSlug, regionSlug, year: yearRaw } = await params;
  const year = parseResearchPageYearParam(yearRaw);
  if (year === null) {
    notFound();
  }

  const data = await loadPublishedYearPage({ topicSlug, regionSlug, year });
  if (!data) {
    notFound();
  }

  return <TopicRegionHubView data={data} />;
}
