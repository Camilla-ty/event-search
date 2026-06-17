import type { LiveSponsorCompanyLogoUpdate, LiveSponsorRow } from "./liveSponsorTypes";

export function applyLiveSponsorCompanyLogoUpdate(
  sponsors: readonly LiveSponsorRow[],
  companyId: string,
  update: LiveSponsorCompanyLogoUpdate,
): LiveSponsorRow[] {
  return sponsors.map((row) => {
    if (row.companies?.id !== companyId) {
      return row;
    }

    return {
      ...row,
      companies: {
        ...row.companies,
        logo_url: update.logo_url,
        logo_source: update.logo_source,
        logo_status: update.logo_status,
        logo_fetched_at: update.logo_fetched_at ?? row.companies.logo_fetched_at ?? null,
      },
    };
  });
}
