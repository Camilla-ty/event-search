import { getEventEditions } from "@/src/lib/queries/events";
import { getSponsorsByEventEdition } from "@/src/lib/queries/sponsors";

type SponsorSearchInput = {
  eventSlug?: string;
  query?: string;
  industry?: string;
};

function normalize(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function companyIndustryString(
  sponsor: NonNullable<Awaited<ReturnType<typeof getSponsorsByEventEdition>>[number]>,
): string {
  const c = sponsor.companies;
  if (!c || typeof c !== "object") return "";
  if (!("industry" in c)) return "";
  const raw = (c as { industry?: string | null }).industry;
  return typeof raw === "string" ? raw : "";
}

export async function getSponsorSearchData({
  eventSlug,
  query,
  industry,
}: SponsorSearchInput) {
  const editions = await getEventEditions();
  const selectedEdition =
    editions?.find((edition) => edition.slug === eventSlug) ?? editions?.[0];

  if (!selectedEdition) {
    return {
      filters: { eventSlug: eventSlug ?? null },
      selectedEvent: null,
      sponsors: [],
    };
  }

  const sponsors = (await getSponsorsByEventEdition(selectedEdition.id)) ?? [];
  const queryValue = normalize(query);
  const industryValue = normalize(industry);

  const filteredSponsors = sponsors.filter((sponsor) => {
    const name = normalize(sponsor.companies?.name);
    const companyIndustry = normalize(companyIndustryString(sponsor));

    const matchesQuery =
      !queryValue ||
      name.includes(queryValue) ||
      companyIndustry.includes(queryValue);

    const matchesIndustry =
      !industryValue || industryValue === "all" || companyIndustry === industryValue;

    return matchesQuery && matchesIndustry;
  });

  return {
    filters: {
      eventSlug: eventSlug ?? null,
      query: query ?? "",
      industry: industry ?? "all",
    },
    selectedEvent: {
      id: selectedEdition.id,
      slug: selectedEdition.slug,
      name: selectedEdition.name,
    },
    sponsors: filteredSponsors,
  };
}
