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

export type SponsorDetailEditionEntry = {
  edition: SponsorDetailEvent;
  tierRank: number | null;
  tierLabel: string | null;
};

export type SponsorDetailSeriesGroup = {
  series: SponsorDetailSeries;
  editions: SponsorDetailEditionEntry[];
};

export type SponsorDetailSummary = {
  sponsoredEditionCount: number;
  /** Set only for authenticated responses. */
  latestActivityAt?: string | null;
};

export type SponsorDetailData = {
  company: SponsorDetailCompany;
  isAuthenticated: boolean;
  summary: SponsorDetailSummary;
  eventSeriesGroups: SponsorDetailSeriesGroup[];
};
