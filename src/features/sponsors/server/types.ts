import type { getCompanyById } from "@/src/lib/queries/companies";
import type { getEventEditions } from "@/src/lib/queries/events";

export type SponsorDetailCompany = NonNullable<
  Awaited<ReturnType<typeof getCompanyById>>
>;

export type SponsorDetailEvent = NonNullable<
  Awaited<ReturnType<typeof getEventEditions>>
>[number];

export type SponsorDetailSeries = {
  id: string;
  name: string;
};

export type SponsorDetailSeriesGroup = {
  series: SponsorDetailSeries;
  editions: SponsorDetailEvent[];
};

export type SponsorDetailData = {
  company: SponsorDetailCompany;
  eventSeriesGroups: SponsorDetailSeriesGroup[];
};
