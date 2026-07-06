import { normalizeCompanyNameKey } from "@/src/lib/companies/companyAliases";
import { importWebsiteMatchKey } from "@/src/lib/domain/importWebsiteMatchKey";

export type ImportMatchCompany = {
  id: string;
  name: string;
  domain: string | null;
  website: string | null;
  aliases: readonly string[];
};

/** Verified domain row from company_domains (internal identity only). */
export type ImportMatchCompanyDomain = {
  company_id: string;
  domain: string;
};

export type ImportMatchContext = {
  companiesByDomain: ReadonlyMap<string, readonly ImportMatchCompany[]>;
  companiesByWebsite: ReadonlyMap<string, readonly ImportMatchCompany[]>;
  companiesByExactName: ReadonlyMap<string, readonly ImportMatchCompany[]>;
  companiesByExactAlias: ReadonlyMap<string, readonly ImportMatchCompany[]>;
};

export type ImportMatchMethod = "domain" | "exact_name" | "alias" | "website";

export type ImportMatchConflictType = "multiple_candidates" | "domain_name_mismatch";

export type ImportMatchDecision = {
  status: "auto_ready" | "needs_review";
  match_method: ImportMatchMethod | null;
  match_confidence: "high" | null;
  proposed_company_id: string | null;
  conflict_type: ImportMatchConflictType | null;
};

export type ImportMatchableRow = {
  normalized_domain: string | null;
  normalized_website: string | null;
  normalized_company_name: string | null;
};

function normalizeImportName(value: string | null | undefined): string {
  return normalizeCompanyNameKey(value ?? "");
}

function exactNameMatches(
  rowName: string | null | undefined,
  companyName: string,
): boolean {
  const rowKey = normalizeImportName(rowName);
  if (rowKey === "") return false;
  return rowKey === normalizeImportName(companyName);
}

/** Returns the matched alias string when the import name equals an alias exactly. */
export function findExactAliasOnCompany(
  rowName: string | null | undefined,
  company: ImportMatchCompany,
): string | null {
  const rowKey = normalizeImportName(rowName);
  if (rowKey === "") return null;

  for (const alias of company.aliases) {
    const trimmed = alias.trim();
    if (trimmed === "") continue;
    if (normalizeImportName(trimmed) === rowKey) {
      return trimmed;
    }
  }

  return null;
}

function autoReady(
  companyId: string,
  match_method: ImportMatchMethod,
): ImportMatchDecision {
  return {
    status: "auto_ready",
    match_method,
    match_confidence: "high",
    proposed_company_id: companyId,
    conflict_type: null,
  };
}

function needsReview(params: {
  proposed_company_id?: string | null;
  conflict_type?: ImportMatchConflictType | null;
}): ImportMatchDecision {
  return {
    status: "needs_review",
    match_method: null,
    match_confidence: null,
    proposed_company_id: params.proposed_company_id ?? null,
    conflict_type: params.conflict_type ?? null,
  };
}

/** Name/alias match without domain — proposed company, researcher must confirm. */
function reviewWithProposal(
  companyId: string,
  match_method: Extract<ImportMatchMethod, "exact_name" | "alias">,
): ImportMatchDecision {
  return {
    status: "needs_review",
    match_method,
    match_confidence: null,
    proposed_company_id: companyId,
    conflict_type: null,
  };
}

function matchByDomain(
  row: ImportMatchableRow,
  context: ImportMatchContext,
): ImportMatchDecision | null {
  const domain = row.normalized_domain?.trim().toLowerCase() ?? "";
  if (domain === "") return null;

  const candidates = context.companiesByDomain.get(domain) ?? [];
  if (candidates.length > 1) {
    return needsReview({ conflict_type: "multiple_candidates" });
  }
  if (candidates.length === 0) {
    return null;
  }

  const candidate = candidates[0];
  if (!candidate) {
    return needsReview({});
  }

  const rowName = row.normalized_company_name?.trim() ?? "";
  if (rowName === "") {
    return autoReady(candidate.id, "domain");
  }

  if (exactNameMatches(rowName, candidate.name)) {
    return autoReady(candidate.id, "domain");
  }

  if (findExactAliasOnCompany(rowName, candidate) !== null) {
    return autoReady(candidate.id, "alias");
  }

  return needsReview({
    proposed_company_id: candidate.id,
    conflict_type: "domain_name_mismatch",
  });
}

function matchByWebsite(
  row: ImportMatchableRow,
  context: ImportMatchContext,
): ImportMatchDecision | null {
  const domain = row.normalized_domain?.trim().toLowerCase() ?? "";
  if (domain !== "") return null;

  const website = row.normalized_website?.trim() ?? "";
  if (website === "") return null;

  const key = importWebsiteMatchKey(website);
  if (!key) return null;

  const candidates = context.companiesByWebsite.get(key) ?? [];
  if (candidates.length > 1) {
    return needsReview({ conflict_type: "multiple_candidates" });
  }
  if (candidates.length === 0) {
    return null;
  }

  const candidate = candidates[0];
  if (!candidate) {
    return needsReview({});
  }

  const rowName = row.normalized_company_name?.trim() ?? "";
  if (rowName === "") {
    return autoReady(candidate.id, "website");
  }

  if (exactNameMatches(rowName, candidate.name)) {
    return autoReady(candidate.id, "website");
  }

  if (findExactAliasOnCompany(rowName, candidate) !== null) {
    return autoReady(candidate.id, "alias");
  }

  return needsReview({
    proposed_company_id: candidate.id,
    conflict_type: "domain_name_mismatch",
  });
}

function matchByExactName(
  rowName: string,
  context: ImportMatchContext,
): ImportMatchDecision | null {
  const nameKey = normalizeImportName(rowName);
  if (nameKey === "") return null;

  const candidates = context.companiesByExactName.get(nameKey) ?? [];
  if (candidates.length > 1) {
    return needsReview({ conflict_type: "multiple_candidates" });
  }
  if (candidates.length === 1) {
    const candidate = candidates[0];
    if (candidate) {
      return reviewWithProposal(candidate.id, "exact_name");
    }
  }

  return null;
}

function matchByExactAlias(
  rowName: string,
  context: ImportMatchContext,
): ImportMatchDecision | null {
  const aliasKey = normalizeImportName(rowName);
  if (aliasKey === "") return null;

  const candidates = context.companiesByExactAlias.get(aliasKey) ?? [];
  if (candidates.length > 1) {
    return needsReview({ conflict_type: "multiple_candidates" });
  }
  if (candidates.length === 1) {
    const candidate = candidates[0];
    if (candidate) {
      return reviewWithProposal(candidate.id, "alias");
    }
  }

  return null;
}

/** Identity-based import matching: domain auto-ready; name/alias are review suggestions. */
export function matchImportRowIdentity(
  row: ImportMatchableRow,
  context: ImportMatchContext,
): ImportMatchDecision {
  const rowName = row.normalized_company_name?.trim() ?? "";

  const domainDecision = matchByDomain(row, context);
  if (domainDecision !== null) {
    return domainDecision;
  }

  const websiteDecision = matchByWebsite(row, context);
  if (websiteDecision !== null) {
    return websiteDecision;
  }

  if (rowName !== "") {
    const nameDecision = matchByExactName(rowName, context);
    if (nameDecision !== null) {
      return nameDecision;
    }

    const aliasDecision = matchByExactAlias(rowName, context);
    if (aliasDecision !== null) {
      return aliasDecision;
    }
  }

  return needsReview({});
}

function addWebsiteCandidate(
  companiesByWebsite: Map<string, ImportMatchCompany[]>,
  key: string,
  company: ImportMatchCompany,
): void {
  const list = companiesByWebsite.get(key) ?? [];
  if (list.some((candidate) => candidate.id === company.id)) {
    return;
  }
  list.push(company);
  companiesByWebsite.set(key, list);
}

function addDomainCandidate(
  companiesByDomain: Map<string, ImportMatchCompany[]>,
  domain: string,
  company: ImportMatchCompany,
): void {
  const domainList = companiesByDomain.get(domain) ?? [];
  if (domainList.some((candidate) => candidate.id === company.id)) {
    return;
  }
  domainList.push(company);
  companiesByDomain.set(domain, domainList);
}

export function buildImportMatchContext(
  companies: readonly ImportMatchCompany[],
  companyDomains: readonly ImportMatchCompanyDomain[] = [],
): ImportMatchContext {
  const companiesById = new Map(companies.map((company) => [company.id, company]));
  const companiesByDomain = new Map<string, ImportMatchCompany[]>();
  const companiesByWebsite = new Map<string, ImportMatchCompany[]>();
  const companiesByExactName = new Map<string, ImportMatchCompany[]>();
  const companiesByExactAlias = new Map<string, ImportMatchCompany[]>();

  for (const company of companies) {
    const domain = company.domain?.trim().toLowerCase() ?? "";
    if (domain !== "") {
      addDomainCandidate(companiesByDomain, domain, company);
    }

    const website = company.website?.trim() ?? "";
    if (website !== "") {
      const websiteKey = importWebsiteMatchKey(website);
      if (websiteKey) {
        addWebsiteCandidate(companiesByWebsite, websiteKey, company);
      }
    }

    const nameKey = normalizeImportName(company.name);
    if (nameKey !== "") {
      const nameList = companiesByExactName.get(nameKey) ?? [];
      nameList.push(company);
      companiesByExactName.set(nameKey, nameList);
    }

    for (const alias of company.aliases) {
      const aliasKey = normalizeImportName(alias);
      if (aliasKey === "") continue;
      const aliasList = companiesByExactAlias.get(aliasKey) ?? [];
      aliasList.push(company);
      companiesByExactAlias.set(aliasKey, aliasList);
    }
  }

  for (const entry of companyDomains) {
    const domain = entry.domain.trim().toLowerCase();
    if (domain === "") continue;

    const company = companiesById.get(entry.company_id);
    if (!company) continue;

    addDomainCandidate(companiesByDomain, domain, company);
  }

  return {
    companiesByDomain,
    companiesByWebsite,
    companiesByExactName,
    companiesByExactAlias,
  };
}
