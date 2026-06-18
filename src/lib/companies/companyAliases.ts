export const MAX_COMPANY_ALIASES = 20;
export const MAX_COMPANY_ALIAS_LENGTH = 120;

export type CompanyAliasSearchFields = {
  name: string;
  slug: string;
  domain: string | null;
  website: string | null;
  aliases: readonly string[];
};

export function normalizeCompanyNameKey(value: string): string {
  return value.trim().toLowerCase();
}

export function parseAliasesFromInput(input: string): string[] {
  return input
    .split(/[\n,]+/)
    .map((part) => part.trim())
    .filter((part) => part !== "");
}

export function formatAliasesForInput(aliases: readonly string[]): string {
  return aliases.join("\n");
}

export type AppendCompanyAliasResult =
  | { ok: true; aliases: string[] }
  | { ok: false; reason: "empty" | "duplicate" | "canonical" | "too_long" | "max" };

/** Add one alias to a list with the same rules as admin save (no duplicate / canonical / limits). */
export function appendCompanyAlias(
  existing: readonly string[],
  candidate: string,
  canonicalName?: string | null,
): AppendCompanyAliasResult {
  const trimmed = candidate.trim();
  if (trimmed === "") {
    return { ok: false, reason: "empty" };
  }
  if (trimmed.length > MAX_COMPANY_ALIAS_LENGTH) {
    return { ok: false, reason: "too_long" };
  }
  if (existing.length >= MAX_COMPANY_ALIASES) {
    return { ok: false, reason: "max" };
  }

  const candidateKey = normalizeCompanyNameKey(trimmed);
  const canonicalKey = canonicalName ? normalizeCompanyNameKey(canonicalName) : null;
  if (canonicalKey !== null && candidateKey === canonicalKey) {
    return { ok: false, reason: "canonical" };
  }

  for (const alias of existing) {
    if (normalizeCompanyNameKey(alias) === candidateKey) {
      return { ok: false, reason: "duplicate" };
    }
  }

  return { ok: true, aliases: [...existing, trimmed] };
}

export function normalizeCompanyAliases(
  raw: readonly string[],
  canonicalName?: string | null,
): string[] {
  const canonicalKey = canonicalName ? normalizeCompanyNameKey(canonicalName) : null;
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of raw) {
    const trimmed = item.trim();
    if (!trimmed || trimmed.length > MAX_COMPANY_ALIAS_LENGTH) {
      continue;
    }

    const key = normalizeCompanyNameKey(trimmed);
    if (canonicalKey !== null && key === canonicalKey) {
      continue;
    }
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(trimmed);
    if (result.length >= MAX_COMPANY_ALIASES) {
      break;
    }
  }

  return result;
}

function fieldContainsSearchTerm(value: string | null | undefined, term: string): boolean {
  const field = value?.trim() ?? "";
  if (field === "") return false;
  return field.toLowerCase().includes(term.toLowerCase());
}

/** Whether the search term matches canonical name, slug, domain, or website. */
export function companyPrimaryFieldMatchesSearch(
  company: CompanyAliasSearchFields,
  searchTerm: string,
): boolean {
  const term = searchTerm.trim();
  if (term === "") return false;

  return (
    fieldContainsSearchTerm(company.name, term) ||
    fieldContainsSearchTerm(company.slug, term) ||
    fieldContainsSearchTerm(company.domain, term) ||
    fieldContainsSearchTerm(company.website, term)
  );
}

/** First alias that matches the search term (case-insensitive substring). */
export function findMatchingAlias(
  aliases: readonly string[],
  searchTerm: string,
): string | null {
  const term = searchTerm.trim();
  if (term === "") return null;

  const termKey = normalizeCompanyNameKey(term);
  for (const alias of aliases) {
    const trimmed = alias.trim();
    if (trimmed === "") continue;
    const aliasKey = normalizeCompanyNameKey(trimmed);
    if (aliasKey.includes(termKey) || termKey.includes(aliasKey)) {
      return trimmed;
    }
  }

  return null;
}

/** When searching, surface which alias matched (null if match was via canonical fields). */
export function resolveCompanySearchMatch(
  company: CompanyAliasSearchFields,
  searchTerm: string,
): { matched_alias: string | null } {
  const term = searchTerm.trim();
  if (term === "") {
    return { matched_alias: null };
  }

  if (companyPrimaryFieldMatchesSearch(company, term)) {
    return { matched_alias: null };
  }

  return { matched_alias: findMatchingAlias(company.aliases, term) };
}

export function companyAliasMatchesSearch(
  company: CompanyAliasSearchFields,
  searchTerm: string,
): boolean {
  return findMatchingAlias(company.aliases, searchTerm) !== null;
}

export function parseCompanyAliasesFromRow(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const result: string[] = [];
  for (const item of raw) {
    if (typeof item === "string" && item.trim() !== "") {
      result.push(item.trim());
    }
  }
  return result;
}
