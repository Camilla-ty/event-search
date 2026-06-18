export type LiveSponsorCompanyLogoUpdate = {
  logo_url: string | null;
  logo_source: string | null;
  logo_status: string | null;
  logo_fetched_at?: string | null;
};

export type LiveSponsorRow = {
  id: string;
  tier_rank: number | null;
  tier_label: string | null;
  display_order: number | null;
  companies: {
    id: string;
    name: string | null;
    slug: string | null;
    domain: string | null;
    logo_url: string | null;
    logo_source: string | null;
    logo_status: string | null;
    logo_fetched_at: string | null;
    aliases: string[];
  } | null;
};

export type SponsorMoveDirection = "up" | "down";

export type LiveSponsorTierGroup = {
  tierRank: number | null;
  tierLabel: string | null;
  sponsors: LiveSponsorRow[];
};
