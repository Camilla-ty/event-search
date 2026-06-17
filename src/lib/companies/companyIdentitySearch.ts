import {
  findMatchingAlias,
  normalizeCompanyNameKey,
} from "@/src/lib/companies/companyAliases";

export type CompanyIdentitySearchFields = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  website: string | null;
  aliases: readonly string[];
};

export type CompanyIdentityMatchKind =
  | "exact_domain"
  | "exact_name"
  | "exact_alias"
  | "name_prefix"
  | "domain_prefix"
  | "alias_prefix"
  | "name_substring"
  | "domain_substring"
  | "slug_substring"
  | "website_substring"
  | "alias_substring";

export type CompanyIdentityMatchScore = {
  score: number;
  match_kind: CompanyIdentityMatchKind;
};

export type RankedCompanyIdentityHit<T extends CompanyIdentitySearchFields> = {
  company: T;
  score: number;
  match_kind: CompanyIdentityMatchKind;
  matched_alias: string | null;
};

const SCORE_BY_KIND: Record<CompanyIdentityMatchKind, number> = {
  exact_domain: 100,
  exact_name: 90,
  exact_alias: 85,
  name_prefix: 70,
  domain_prefix: 65,
  alias_prefix: 60,
  name_substring: 40,
  domain_substring: 35,
  slug_substring: 35,
  website_substring: 30,
  alias_substring: 25,
};

function normalizeField(value: string | null | undefined): string {
  return normalizeCompanyNameKey(value ?? "");
}

function fieldContainsQuery(field: string, queryKey: string): boolean {
  return field !== "" && field.includes(queryKey);
}

function fieldStartsWithQuery(field: string, queryKey: string): boolean {
  return field !== "" && field.startsWith(queryKey);
}

function scoreAliasMatch(
  aliases: readonly string[],
  queryKey: string,
): CompanyIdentityMatchScore | null {
  let best: CompanyIdentityMatchScore | null = null;

  for (const alias of aliases) {
    const aliasKey = normalizeField(alias);
    if (aliasKey === "") continue;

    let candidate: CompanyIdentityMatchScore | null = null;
    if (aliasKey === queryKey) {
      candidate = { score: SCORE_BY_KIND.exact_alias, match_kind: "exact_alias" };
    } else if (aliasKey.startsWith(queryKey) || queryKey.startsWith(aliasKey)) {
      candidate = { score: SCORE_BY_KIND.alias_prefix, match_kind: "alias_prefix" };
    } else if (aliasKey.includes(queryKey) || queryKey.includes(aliasKey)) {
      candidate = { score: SCORE_BY_KIND.alias_substring, match_kind: "alias_substring" };
    }

    if (candidate !== null && (best === null || candidate.score > best.score)) {
      best = candidate;
    }
  }

  return best;
}

function scoreAliasOnlyMatch(
  aliases: readonly string[],
  rawQuery: string,
): CompanyIdentityMatchScore | null {
  const query = normalizeAdminCompanySearchQuery(rawQuery);
  if (query === "") return null;
  return scoreAliasMatch(aliases, normalizeCompanyNameKey(query));
}

/** Whether the query matches any alias (not canonical name, domain, or slug). */
export function companyMatchesAdminSearchByAliasOnly(
  company: CompanyIdentitySearchFields,
  rawQuery: string,
): boolean {
  return scoreAliasOnlyMatch(company.aliases, rawQuery) !== null;
}

function pickHigherScore(
  current: CompanyIdentityMatchScore | null,
  next: CompanyIdentityMatchScore | null,
): CompanyIdentityMatchScore | null {
  if (next === null) return current;
  if (current === null) return next;
  return next.score > current.score ? next : current;
}

/** Trim user input; admin search uses the trimmed string as-is for matching. */
export function normalizeAdminCompanySearchQuery(raw: string): string {
  return raw.trim();
}

export function isAdminCompanySearchQueryValid(raw: string): boolean {
  return normalizeAdminCompanySearchQuery(raw) !== "";
}

/** Whether any identity field matches the admin search query. */
export function companyMatchesAdminSearch(
  company: CompanyIdentitySearchFields,
  rawQuery: string,
): boolean {
  return scoreCompanyIdentityMatch(company, rawQuery) !== null;
}

/** Score a company against an admin search query; null when there is no match. */
export function scoreCompanyIdentityMatch(
  company: CompanyIdentitySearchFields,
  rawQuery: string,
): CompanyIdentityMatchScore | null {
  const query = normalizeAdminCompanySearchQuery(rawQuery);
  if (query === "") return null;

  const queryKey = normalizeCompanyNameKey(query);
  const nameKey = normalizeField(company.name);
  const slugKey = normalizeField(company.slug);
  const domainKey = normalizeField(company.domain);
  const websiteKey = normalizeField(company.website);

  let best: CompanyIdentityMatchScore | null = null;

  if (domainKey !== "") {
    if (domainKey === queryKey) {
      best = pickHigherScore(best, {
        score: SCORE_BY_KIND.exact_domain,
        match_kind: "exact_domain",
      });
    } else if (fieldStartsWithQuery(domainKey, queryKey)) {
      best = pickHigherScore(best, {
        score: SCORE_BY_KIND.domain_prefix,
        match_kind: "domain_prefix",
      });
    } else if (fieldContainsQuery(domainKey, queryKey)) {
      best = pickHigherScore(best, {
        score: SCORE_BY_KIND.domain_substring,
        match_kind: "domain_substring",
      });
    }
  }

  if (nameKey !== "") {
    if (nameKey === queryKey) {
      best = pickHigherScore(best, {
        score: SCORE_BY_KIND.exact_name,
        match_kind: "exact_name",
      });
    } else if (fieldStartsWithQuery(nameKey, queryKey)) {
      best = pickHigherScore(best, {
        score: SCORE_BY_KIND.name_prefix,
        match_kind: "name_prefix",
      });
    } else if (fieldContainsQuery(nameKey, queryKey)) {
      best = pickHigherScore(best, {
        score: SCORE_BY_KIND.name_substring,
        match_kind: "name_substring",
      });
    }
  }

  best = pickHigherScore(best, scoreAliasMatch(company.aliases, queryKey));

  if (slugKey !== "" && fieldContainsQuery(slugKey, queryKey)) {
    best = pickHigherScore(best, {
      score: SCORE_BY_KIND.slug_substring,
      match_kind: "slug_substring",
    });
  }

  if (websiteKey !== "" && fieldContainsQuery(websiteKey, queryKey)) {
    best = pickHigherScore(best, {
      score: SCORE_BY_KIND.website_substring,
      match_kind: "website_substring",
    });
  }

  return best;
}

function primaryIdentityFieldMatchesSearch(
  company: CompanyIdentitySearchFields,
  rawQuery: string,
): boolean {
  const query = normalizeAdminCompanySearchQuery(rawQuery);
  if (query === "") return false;

  const queryKey = normalizeCompanyNameKey(query);
  return (
    fieldContainsQuery(normalizeField(company.name), queryKey) ||
    fieldContainsQuery(normalizeField(company.slug), queryKey) ||
    fieldContainsQuery(normalizeField(company.domain), queryKey) ||
    fieldContainsQuery(normalizeField(company.website), queryKey)
  );
}

/** UI hint when the match came from an alias rather than canonical identity fields. */
export function resolveSearchMatchHint(
  company: CompanyIdentitySearchFields,
  rawQuery: string,
): { matched_alias: string | null } {
  const query = normalizeAdminCompanySearchQuery(rawQuery);
  if (query === "") {
    return { matched_alias: null };
  }

  if (primaryIdentityFieldMatchesSearch(company, query)) {
    return { matched_alias: null };
  }

  return { matched_alias: findMatchingAlias(company.aliases, query) };
}

function compareRankedHits<T extends CompanyIdentitySearchFields>(
  a: RankedCompanyIdentityHit<T>,
  b: RankedCompanyIdentityHit<T>,
): number {
  if (a.score !== b.score) {
    return b.score - a.score;
  }
  return a.company.name.localeCompare(b.company.name);
}

/** Dedupe by company id, score matches, and sort by relevance then name. */
export function rankCompanySearchHits<T extends CompanyIdentitySearchFields>(
  companies: readonly T[],
  rawQuery: string,
): RankedCompanyIdentityHit<T>[] {
  const query = normalizeAdminCompanySearchQuery(rawQuery);
  if (query === "") return [];

  const bestById = new Map<string, RankedCompanyIdentityHit<T>>();

  for (const company of companies) {
    const scored = scoreCompanyIdentityMatch(company, query);
    if (scored === null) continue;

    const hit: RankedCompanyIdentityHit<T> = {
      company,
      score: scored.score,
      match_kind: scored.match_kind,
      matched_alias: resolveSearchMatchHint(company, query).matched_alias,
    };

    const existing = bestById.get(company.id);
    if (existing === undefined || hit.score > existing.score) {
      bestById.set(company.id, hit);
    }
  }

  return Array.from(bestById.values()).sort(compareRankedHits);
}
