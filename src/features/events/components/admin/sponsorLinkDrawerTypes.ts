export type SponsorCreateSavedPayload = {
  link: {
    id: string;
    tier_rank: number | null;
    tier_label: string | null;
    display_order: number | null;
    company_id: string;
  };
  company: {
    id: string;
    name: string;
    domain: string | null;
  };
};

export type SponsorEditSavedPayload =
  | {
      kind: "label";
      linkId: string;
      tier_label: string | null;
    }
  | {
      kind: "tier";
    };
