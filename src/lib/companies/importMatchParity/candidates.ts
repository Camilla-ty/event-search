import { normalizeCompanyNameKey } from "@/src/lib/companies/companyAliases";
import type {
  ImportMatchContext,
  ImportMatchableRow,
} from "@/src/lib/companies/companyImportMatching";
import {
  barePlatformOwnerRootHost,
  importWebsiteMatchKey,
} from "@/src/lib/domain/importWebsiteMatchKey";

/**
 * Candidate company ids for the lookup keys this row would hit.
 * Order is stable: domain owners → website owners → primary-domain (bare platform) →
 * exact name → exact alias, de-duplicated in first-seen order.
 */
export function listImportMatchCandidateCompanyIds(
  row: ImportMatchableRow,
  context: ImportMatchContext,
): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  function pushAll(companies: readonly { id: string }[] | undefined) {
    if (!companies) return;
    for (const company of companies) {
      if (seen.has(company.id)) continue;
      seen.add(company.id);
      ordered.push(company.id);
    }
  }

  const domain = row.normalized_domain?.trim().toLowerCase() ?? "";
  if (domain !== "") {
    pushAll(context.companiesByDomain.get(domain));
  }

  if (domain === "") {
    const website = row.normalized_website?.trim() ?? "";
    if (website !== "") {
      const websiteKey = importWebsiteMatchKey(website);
      if (websiteKey) {
        pushAll(context.companiesByWebsite.get(websiteKey));
      }
      const host = barePlatformOwnerRootHost(website);
      if (host) {
        pushAll(context.companiesByPrimaryDomain.get(host));
      }
    }
  }

  const nameKey = normalizeCompanyNameKey(row.normalized_company_name ?? "");
  if (nameKey !== "") {
    pushAll(context.companiesByExactName.get(nameKey));
    pushAll(context.companiesByExactAlias.get(nameKey));
  }

  return ordered;
}
