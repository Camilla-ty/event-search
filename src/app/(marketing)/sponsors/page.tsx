import type { CompanyPublicRow } from "@/src/lib/queries/companies";
import { getSponsorSearchData } from "@/src/features/sponsors/server/getSponsorSearchData";
import { SponsorSearchPage } from "@/src/features/sponsors/components/search/SponsorSearchPage";
import type { SponsorRecord } from "@/src/features/sponsors/components/search/types";

export const dynamic = "force-dynamic";

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
    industry: extended.industry ?? null,
    location: extended.location ?? null,
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
    companies: sponsor.companies ? sponsorCompanyFromRow(sponsor.companies) : null,
  }));

  return (
    <SponsorSearchPage
      sponsors={sponsors}
      initialFilters={{
        query: data.filters.query ?? "",
        industry: data.filters.industry ?? "all",
      }}
    />
  );
}
