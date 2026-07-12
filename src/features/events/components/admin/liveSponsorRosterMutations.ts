import { isRosterOrderDirty } from "./liveSponsorReorderClient";
import type { LiveSponsorRow } from "./liveSponsorTypes";

export type SponsorLinkMutationRow = {
  id: string;
  tier_rank: number | null;
  tier_label: string | null;
  display_order: number | null;
  company_id: string;
};

export type SponsorCreateCompany = {
  id: string;
  name: string;
  domain: string | null;
};

function buildCompanyFromCreate(
  company: SponsorCreateCompany,
): NonNullable<LiveSponsorRow["companies"]> {
  return {
    id: company.id,
    name: company.name,
    slug: null,
    domain: company.domain,
    logo_url: null,
    logo_source: null,
    logo_status: null,
    logo_fetched_at: null,
    aliases: [],
  };
}

export function buildLiveSponsorRowFromCreate(
  link: SponsorLinkMutationRow,
  company: SponsorCreateCompany,
): LiveSponsorRow {
  return {
    id: link.id,
    tier_rank: link.tier_rank,
    tier_label: link.tier_label,
    display_order: link.display_order,
    companies: buildCompanyFromCreate(company),
  };
}

export function applySponsorCreate(
  sponsors: readonly LiveSponsorRow[],
  link: SponsorLinkMutationRow,
  company: SponsorCreateCompany,
): LiveSponsorRow[] {
  return [...sponsors, buildLiveSponsorRowFromCreate(link, company)];
}

export function applySponsorRemove(
  sponsors: readonly LiveSponsorRow[],
  linkId: string,
): LiveSponsorRow[] {
  return sponsors.filter((row) => row.id !== linkId);
}

export function applySponsorLabelEdit(
  sponsors: readonly LiveSponsorRow[],
  linkId: string,
  tierLabel: string | null,
): LiveSponsorRow[] {
  return sponsors.map((row) =>
    row.id === linkId ? { ...row, tier_label: tierLabel } : row,
  );
}

export function applyRefetchedRoster(
  freshSponsors: LiveSponsorRow[],
  currentSaved: readonly LiveSponsorRow[],
  currentDraft: readonly LiveSponsorRow[],
): { savedRoster: LiveSponsorRow[]; draftRoster: LiveSponsorRow[] } {
  if (isRosterOrderDirty(currentSaved, currentDraft)) {
    return { savedRoster: freshSponsors, draftRoster: [...currentDraft] };
  }
  return { savedRoster: freshSponsors, draftRoster: freshSponsors };
}
