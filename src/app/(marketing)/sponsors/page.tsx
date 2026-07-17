import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SponsorSearchPage } from "@/src/features/sponsors/components/search/SponsorSearchPage";
import { getSponsorDiscoveryPage } from "@/src/features/sponsors/server/getSponsorDiscoveryPage";
import { buildSponsorDiscoveryPath } from "@/src/features/sponsors/server/sponsorDiscoveryParams";
import { createPageMetadata } from "@/src/lib/metadata/site";
import {
  getCollectionIndexability,
  robotsForIndexability,
  sponsorCollectionHasFilterOrSearchParams,
} from "@/src/lib/seo/indexability";

export const dynamic = "force-dynamic";

type SponsorsPageProps = {
  searchParams: Promise<{
    event?: string;
    q?: string;
    sort?: string;
    page?: string;
  }>;
};

export async function generateMetadata({
  searchParams,
}: SponsorsPageProps): Promise<Metadata> {
  const raw = await searchParams;
  const decision = getCollectionIndexability({
    hasFilterOrSearchParams: sponsorCollectionHasFilterOrSearchParams(raw),
  });

  return createPageMetadata({
    title: "Sponsors",
    description: "Discover companies that sponsor events across EventPixels.",
    path: "/sponsors",
    robots: robotsForIndexability(decision),
  });
}

export default async function SponsorsPage({ searchParams }: SponsorsPageProps) {
  const { event, q, sort, page } = await searchParams;
  const data = await getSponsorDiscoveryPage({
    q,
    event,
    sort,
    page,
  });

  if (data.pageWasClamped) {
    redirect(buildSponsorDiscoveryPath(data.params));
  }

  return <SponsorSearchPage initial={data} />;
}
