export type SponsorSuggestItem = {
  id: string;
  slug: string;
  name: string;
  domain: string | null;
  logo_url: string | null;
};

export type SponsorSuggestResult = {
  query: string;
  items: SponsorSuggestItem[];
  total: number;
};

export type SponsorSuggestInput = {
  q?: string | null;
  limit?: string | number | null;
};
