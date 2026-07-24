import { normalizeCompanyNameKey } from "@/src/lib/companies/companyAliases";
import {
  classifyCompanyWebsiteTier,
  resolveCompanyWebsiteIdentity,
  selectCanonicalCompanyWebsite,
} from "@/src/lib/domain/hostedPlatformWebsite";
import { normalizeWebsiteClusterKey } from "@/src/lib/domain/importWebsiteMatchKey";

export { normalizeWebsiteClusterKey };

export type WebsiteNormalizableRow = {
  normalized_company_name: string | null;
  normalized_website: string | null;
  normalized_domain: string | null;
};

export function duplicateClusterKey(
  row: WebsiteNormalizableRow & { excel_row_number: number },
): string {
  if (row.normalized_domain?.trim()) {
    return `domain:${row.normalized_domain.trim().toLowerCase()}`;
  }
  if (row.normalized_website?.trim()) {
    return normalizeWebsiteClusterKey(row.normalized_website);
  }
  const name = row.normalized_company_name?.trim().toLowerCase() ?? "";
  if (name !== "") return `name:${name}`;
  return `row:${row.excel_row_number}`;
}

export function domainFromWebsite(website: string | null): string | null {
  if (!website?.trim()) return null;
  const identity = resolveCompanyWebsiteIdentity(website.trim());
  return identity.status === "domain" ? identity.domain : null;
}

export function applyCanonicalWebsiteFields(
  website: string | null,
): Pick<WebsiteNormalizableRow, "normalized_website" | "normalized_domain"> {
  if (!website?.trim()) {
    return { normalized_website: null, normalized_domain: null };
  }
  const trimmed = website.trim();
  return {
    normalized_website: trimmed,
    normalized_domain: domainFromWebsite(trimmed),
  };
}

/** True when batch rows share a company name but span different ADR-002 website tiers. */
export function shouldMergeWebsiteCandidates(urls: readonly string[]): boolean {
  if (urls.length <= 1) return false;

  const canonical = selectCanonicalCompanyWebsite(urls);
  if (!canonical) return false;

  const canonicalTier = classifyCompanyWebsiteTier(canonical);
  if (canonicalTier === null) return false;

  return urls.some((url) => {
    const tier = classifyCompanyWebsiteTier(url);
    return tier !== null && tier !== canonicalTier;
  });
}

/**
 * Across a batch, pick the ADR-002 canonical website per company name and align
 * normalized_website / normalized_domain on every row for that name.
 */
export function finalizeImportRowWebsites<T extends WebsiteNormalizableRow>(
  rows: readonly T[],
): T[] {
  const websitesByName = new Map<string, string[]>();

  for (const row of rows) {
    const nameKey = normalizeCompanyNameKey(row.normalized_company_name ?? "");
    if (nameKey === "") continue;
    const website = row.normalized_website?.trim();
    if (!website) continue;
    const list = websitesByName.get(nameKey) ?? [];
    if (!list.includes(website)) list.push(website);
    websitesByName.set(nameKey, list);
  }

  return rows.map((row) => {
    const nameKey = normalizeCompanyNameKey(row.normalized_company_name ?? "");
    if (nameKey === "") return row;

    const candidates = websitesByName.get(nameKey) ?? [];
    if (!shouldMergeWebsiteCandidates(candidates)) return row;

    const canonical = selectCanonicalCompanyWebsite(candidates);
    if (!canonical) return row;

    return { ...row, ...applyCanonicalWebsiteFields(canonical) };
  });
}

/** Pick canonical website from import candidates (ADR-002 tier order). */
export function selectImportCanonicalWebsite(urls: readonly string[]): string | null {
  return selectCanonicalCompanyWebsite(urls);
}
