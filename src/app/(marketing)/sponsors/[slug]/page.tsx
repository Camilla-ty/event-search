import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { JsonLd } from "@/src/components/seo/JsonLd";
import { getPublicExhibitorHistoryForCompany } from "@/src/features/exhibitors/server/exhibitorHistoryPublic";
import { SponsorDetailView } from "@/src/features/sponsors/components/detail/SponsorDetailView";
import { getSponsorDetailData } from "@/src/features/sponsors/server/getSponsorDetailData";
import { getProfileRoleForUserId, isAdminRole } from "@/src/lib/auth/appProfile";
import {
  isEventBrandCompanyPublicProfileSoftRetired,
  resolveEventBrandSponsorProfileRedirect,
} from "@/src/lib/companies/resolvePublicCompanyDestination";
import { buildCompanySummary } from "@/src/lib/content/factualSummary";
import { locationInputFromCityEmbed } from "@/src/lib/location/parseLocationEmbed";
import {
  createNotFoundPageMetadata,
  createPageMetadata,
} from "@/src/lib/metadata/site";
import {
  getCompanyIndexability,
  robotsForIndexability,
} from "@/src/lib/seo/indexability";
import { buildOrganizationJsonLd } from "@/src/lib/seo/organizationJsonLd";
import { buildSponsorMetadataDescription } from "@/src/lib/seo/sponsorMetadata";
import { createClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";

type SponsorDetailPageProps = {
  params: Promise<{ slug: string }>;
};

function eventBrandDestinationInput(
  data: NonNullable<Awaited<ReturnType<typeof getSponsorDetailData>>>,
) {
  return {
    company: {
      id: data.company.id,
      slug: data.company.slug,
      status: "active" as const,
      restricted_at: data.company.restricted_at ?? null,
      merged_into_company_id: null,
      event_brand_public_profile_approved_at:
        data.company.event_brand_public_profile_approved_at ?? null,
    },
    sameBrandSeries: data.sameBrandSeries,
  };
}

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
  const destinationInput = eventBrandDestinationInput(data);
  const softRetired = isEventBrandCompanyPublicProfileSoftRetired(destinationInput);
  const decision = getCompanyIndexability({
    restricted: false,
    sponsoredEditionCount: data.summary.sponsoredEditionCount,
    id: data.company.id,
    slug: data.company.slug,
    status: "active",
    eventBrandPublicProfileApprovedAt:
      data.company.event_brand_public_profile_approved_at ?? null,
    sameBrandSeries: data.sameBrandSeries,
  });
  // Fail open: a stats query failure means the count is unknown, not zero.
  // Never emit noindex off an unknown count (indexability-policy §IR1 review).
  // Soft-retired Event Brand Companies (ADR-005 EB2) always noindex regardless.
  const countUnknown = data.summary.sponsoredEditionCountUnknown === true;

  return createPageMetadata({
    title: name,
    description,
    path: `/sponsors/${profileSlug}`,
    robots:
      softRetired || !countUnknown
        ? robotsForIndexability(decision)
        : undefined,
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

  // ADR-005 EB3: temporary redirect approved Event Brand Companies to Series hub.
  const seriesHubRedirect = resolveEventBrandSponsorProfileRedirect(
    eventBrandDestinationInput(data),
  );
  if (seriesHubRedirect !== null) {
    redirect(seriesHubRedirect);
  }

  // Independent of Sponsor History auth gate: full exhibitor list for all visitors.
  const exhibitorHistoryGroups = await getPublicExhibitorHistoryForCompany(
    data.company.id,
  );

  const viewerRole =
    user !== null ? await getProfileRoleForUserId(supabase, user.id) : null;
  const companyId =
    typeof data.company.id === "string" && data.company.id.trim() !== ""
      ? data.company.id.trim()
      : null;
  const showAdminEditLink = isAdminRole(viewerRole) && companyId !== null;

  const company = data.company;
  const companyName =
    typeof company.name === "string" && company.name.trim() !== ""
      ? company.name.trim()
      : "";
  const factualSummary = buildCompanySummary({
    name: companyName || "Company profile",
    website: company.website,
    domain: company.domain,
    sponsoredEditionCount: data.summary.sponsoredEditionCount,
    sponsoredEditionCountUnknown:
      data.summary.sponsoredEditionCountUnknown === true,
  });
  // JSON-LD uses the real name only; UI may still show "Company profile".
  const organizationJsonLd = buildOrganizationJsonLd({
    name: companyName,
    slug: company.slug,
    id: company.id,
    restricted_at: company.restricted_at,
    logoUrl: company.logo_url,
    website: company.website,
    domain: company.domain,
    description: companyName !== "" ? factualSummary : null,
    city: locationInputFromCityEmbed(company.cities),
  });

  return (
    <>
      {organizationJsonLd ? <JsonLd data={organizationJsonLd} /> : null}
      <SponsorDetailView
        data={data}
        exhibitorHistoryGroups={exhibitorHistoryGroups}
        showAdminEditLink={showAdminEditLink}
      />
    </>
  );
}
