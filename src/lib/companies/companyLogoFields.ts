import type { CompanyLogoFields } from "@/src/lib/companies/logoTypes";
import { mapPublicLogoUrl } from "@/src/lib/storage/mapPublicLogoUrl";

/** Minimal company row shape needed for public logo resolution. */
export type CompanyPublicLogoRow = {
  name?: string | null;
  logo_url?: string | null;
  domain?: string | null;
  logo_source?: string | null;
  logo_status?: string | null;
};

export function companyLogoFieldsFromRow(
  row: CompanyPublicLogoRow | null | undefined,
): CompanyLogoFields {
  if (!row) {
    return {
      name: null,
      logo_url: null,
      domain: null,
      logo_source: null,
      logo_status: null,
    };
  }

  return {
    name: row.name ?? null,
    logo_url: mapPublicLogoUrl(row.logo_url),
    domain: row.domain ?? null,
    logo_source: row.logo_source ?? null,
    logo_status: row.logo_status ?? null,
  };
}
