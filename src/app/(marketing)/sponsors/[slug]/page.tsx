import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getPublicExhibitorHistoryForCompany } from "@/src/features/exhibitors/server/exhibitorHistoryPublic";
import { SponsorDetailView } from "@/src/features/sponsors/components/detail/SponsorDetailView";
import { getSponsorDetailData } from "@/src/features/sponsors/server/getSponsorDetailData";
import {
  createNotFoundPageMetadata,
  createPageMetadata,
} from "@/src/lib/metadata/site";
import {
  getCompanyIndexability,
  robotsForIndexability,
} from "@/src/lib/seo/indexability";
import { buildSponsorMetadataDescription } from "@/src/lib/seo/sponsorMetadata";
import { createClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";

type SponsorDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: SponsorDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getSponsorDetailData(slug, { isAuthenticated: false });
  if (!data?.company) {
    return createNotFoundPageMetadata(`/sponsors/${slug}`);
  }

  const name = data.company.name?.trim() || "Sponsor";
  const description = buildSponsorMetadataDescription({
    name,
    website: data.company.website,
    domain: data.company.domain,
    sponsoredEditionCount: data.summary.sponsoredEditionCount,
    sponsoredEditionCountUnknown:
      data.summary.sponsoredEditionCountUnknown === true,
  });
  const profileSlug = data.company.slug?.trim() || slug;
  const decision = getCompanyIndexability({
    restricted: false,
    sponsoredEditionCount: data.summary.sponsoredEditionCount,
  });
  // Fail open: a stats query failure means the count is unknown, not zero.
  // Never emit noindex off an unknown count (indexability-policy §IR1 review).
  const countUnknown = data.summary.sponsoredEditionCountUnknown === true;

  return createPageMetadata({
    title: name,
    description,
    path: `/sponsors/${profileSlug}`,
    robots: countUnknown ? undefined : robotsForIndexability(decision),
  });
}

export default async function SponsorDetailPage({
  params,
}: SponsorDetailPageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const data = await getSponsorDetailData(slug, {
    isAuthenticated: user !== null,
  });

  if (!data) {
    notFound();
  }

  // Independent of Sponsor History auth gate: full exhibitor list for all visitors.
  const exhibitorHistoryGroups = await getPublicExhibitorHistoryForCompany(
    data.company.id,
  );

  return (
    <SponsorDetailView
      data={data}
      exhibitorHistoryGroups={exhibitorHistoryGroups}
    />
  );
}
