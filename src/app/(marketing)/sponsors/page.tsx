import { SponsorSearchPage } from "@/src/features/sponsors/components/search/SponsorSearchPage";
import type { SponsorRecord } from "@/src/features/sponsors/components/search/types";
import { getSponsorSearchData } from "@/src/features/sponsors/server/getSponsorSearchData";
import { createPageMetadata } from "@/src/lib/metadata/site";
import { formatLocationFromCityEmbed } from "@/src/lib/location/parseLocationEmbed";
import type { CompanyPublicRow } from "@/src/lib/queries/companies";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "Sponsors Search",
  description: "Find and analyze sponsors and companies across events.",
  path: "/sponsors",
});

type SponsorsPageProps = {
  searchParams: Promise<{
    event?: string;
    q?: string;
    industry?: string;
  }>;
};

function sponsorCompanyFromRow(row: CompanyPublicRow): SponsorRecord["companies"] {
  const extended = row as CompanyPublicRow & {
    industry?: string | null;
    location?: string | null;
    countries_active_count?: number | null;
    slug?: string | null;
  };
  return {
    id: row.id ?? null,
    slug: extended.slug ?? null,
    name: row.name ?? null,
    logo_url: row.logo_url ?? null,
    domain: row.domain ?? null,
    logo_source: row.logo_source ?? null,
    logo_status: row.logo_status ?? null,
    industry: extended.industry ?? null,
    location:
      formatLocationFromCityEmbed(row.cities) ||
      extended.location ||
      null,
    countries_active_count: extended.countries_active_count ?? null,
  };
}

export default async function SponsorsPage({ searchParams }: SponsorsPageProps) {
  const { event, q, industry } = await searchParams;
  const data = await getSponsorSearchData({
    eventSlug: event,
    query: q,
    industry,
  });
  const sponsors: SponsorRecord[] = (data.sponsors ?? []).map((sponsor) => ({
    id: String(sponsor.id),
    tier_rank: sponsor.tier_rank ?? null,
    tier_label: typeof sponsor.tier_label === "string" ? sponsor.tier_label : null,
    display_order:
      typeof sponsor.display_order === "number" ? sponsor.display_order : null,
    companies: sponsor.companies ? sponsorCompanyFromRow(sponsor.companies) : null,
  }));

  const eventSlugFromUrl = event?.trim() ?? "";

  return (
    <SponsorSearchPage
      sponsors={sponsors}
      initialFilters={{
        query: data.filters.query ?? "",
        industry: data.filters.industry ?? "all",
        eventSlug: eventSlugFromUrl !== "" ? eventSlugFromUrl : null,
      }}
      eventContext={
        eventSlugFromUrl !== ""
          ? {
              slug: eventSlugFromUrl,
              name: data.selectedEvent?.name ?? null,
            }
          : null
      }
    />
  );
}
