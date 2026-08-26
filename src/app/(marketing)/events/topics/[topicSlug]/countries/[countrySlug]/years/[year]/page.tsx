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
import {
  getTopicRegionHubIndexability,
  robotsForIndexability,
} from "@/src/lib/seo/indexability";

export const dynamic = "force-dynamic";

type Params = { topicSlug: string; countrySlug: string; year: string };

async function loadPublishedYearPage(params: {
  topicSlug: string;
  countrySlug: string;
  year: number;
}) {
  const location = { type: "country" as const, slug: params.countrySlug };

  const published = await getPublishedResearchPageBySlugsPublic(
    params.topicSlug,
    location,
    params.year,
  );
  if (!published) return null;

  return getTopicRegionHubPageData(params.topicSlug, location, params.year);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { topicSlug, countrySlug, year: yearRaw } = await params;
  const year = parseResearchPageYearParam(yearRaw);
  const location = { type: "country" as const, slug: countrySlug };

  if (year === null) {
    return createNotFoundPageMetadata(
      formatResearchPagePublicPath(topicSlug, location, null),
    );
  }

  const data = await loadPublishedYearPage({ topicSlug, countrySlug, year });
  if (!data) {
    return createNotFoundPageMetadata(
      formatResearchPagePublicPath(topicSlug, location, year),
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

export default async function TopicCountryYearHubPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { topicSlug, countrySlug, year: yearRaw } = await params;
  const year = parseResearchPageYearParam(yearRaw);
  if (year === null) {
    notFound();
  }

  const data = await loadPublishedYearPage({ topicSlug, countrySlug, year });
  if (!data) {
    notFound();
  }

  return <TopicRegionHubView data={data} />;
}
