/** manual = admin-curated; brandfetch = admin Brand API upgrade; storage = auto-ingest; none = no logo path */
export const LOGO_SOURCES = ["manual", "brandfetch", "storage", "logo_dev", "none"] as const;
export type LogoSource = (typeof LOGO_SOURCES)[number];

export const LOGO_STATUSES = ["ok", "pending", "missing", "error", "skipped"] as const;
export type LogoStatus = (typeof LOGO_STATUSES)[number];

export type CompanyLogoFields = {
  name?: string | null;
  logo_url?: string | null;
  domain?: string | null;
  logo_source?: string | null;
  logo_status?: string | null;
};

export type ResolvedCompanyLogo =
  | { kind: "image"; src: string }
  | { kind: "monogram"; letter: string };
