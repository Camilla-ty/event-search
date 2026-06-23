/**
 * Shared read-only scan + plan helpers for Option B community-identity audit/cleanup.
 */

import { resolveCompanyWebsiteIdentity } from "@/src/lib/domain/hostedPlatformWebsite";

import type { createBackfillSupabaseClient } from "../backfill/core/supabase";

export type Supabase = ReturnType<typeof createBackfillSupabaseClient>;

export const TERMINAL_BATCH_STATUSES = ["published", "discarded"];

export const UNSAFE_BARE_HOSTS = [
  "discord.com",
  "discord.gg",
  "discordapp.com",
  "instagram.com",
  "tiktok.com",
  "github.com",
  "linkedin.com",
];

export const COMMUNITY_WEBSITE_ILIKE = [
  "website.ilike.%discord.com%",
  "website.ilike.%discord.gg%",
  "website.ilike.%discordapp.com%",
  "website.ilike.%instagram.com%",
  "website.ilike.%tiktok.com%",
  "website.ilike.%github.com%",
  "website.ilike.%linkedin.com%",
  "website.ilike.%t.me/%",
  "website.ilike.%telegram.me/%",
].join(",");

export const PAGE_SIZE = 1000;

export type CompanyRow = {
  id: string;
  name: string | null;
  domain: string | null;
  website: string | null;
  logo_url: string | null;
  logo_source: string | null;
  status: string | null;
};

export type ImportRow = {
  id: string;
  batch_id: string;
  raw_company_name: string | null;
  raw_website: string | null;
  normalized_domain: string | null;
  proposed_company_id: string | null;
  match_method: string | null;
  match_confidence: string | null;
  conflict_type: string | null;
  status: string | null;
  decision_type: string | null;
  decision_source: string | null;
  resolved_company_id: string | null;
  decision_by: string | null;
  decision_at: string | null;
};

export type CompanyFinding = {
  id: string;
  name: string | null;
  website: string | null;
  current_domain: string | null;
  resolved_status: "no_identity";
  would_be_domain: null;
  logo_source: string | null;
  company_status: string | null;
};

export type UnsafeDomainFinding = {
  id: string;
  name: string | null;
  domain: string | null;
  website: string | null;
  company_status: string | null;
};

export type CollisionFinding = {
  domain: string;
  company_count: number;
  companies: Array<{ id: string; name: string | null; website: string | null }>;
};

export type ImportFinding = {
  id: string;
  batch_id: string;
  raw_company_name: string | null;
  raw_website: string | null;
  current_normalized_domain: string | null;
  would_be_normalized_domain: null;
  proposed_company_id: string | null;
  match_method: string | null;
  match_confidence: string | null;
  row_status: string | null;
  invalidates_domain_match: boolean;
};

export type CompanyPlan = {
  row: CompanyRow;
  patch: { domain: null };
};

export type ImportPlan = {
  row: ImportRow;
  patch: Record<string, unknown>;
  clearProposedMatch: boolean;
  resetResolvedDomainMatch: boolean;
};

export async function fetchAllCompaniesByWebsiteFilter(supabase: Supabase): Promise<CompanyRow[]> {
  const all: CompanyRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("companies")
      .select("id, name, domain, website, logo_url, logo_source, status")
      .not("website", "is", null)
      .or(COMMUNITY_WEBSITE_ILIKE)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`load community-website companies failed: ${error.message}`);
    const page = (data ?? []) as CompanyRow[];
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return all;
}

export async function fetchCompaniesByUnsafeDomain(supabase: Supabase): Promise<CompanyRow[]> {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, domain, website, logo_url, logo_source, status")
    .in("domain", UNSAFE_BARE_HOSTS)
    .order("domain", { ascending: true });
  if (error) throw new Error(`load unsafe-domain companies failed: ${error.message}`);
  return (data ?? []) as CompanyRow[];
}

export async function fetchOpenBatchRows(supabase: Supabase): Promise<ImportRow[]> {
  const { data: batches, error: batchErr } = await supabase
    .from("sponsor_import_batches")
    .select("id, status");
  if (batchErr) throw new Error(`load batches failed: ${batchErr.message}`);

  const openBatchIds = ((batches ?? []) as Array<{ id: string; status: string }>)
    .filter((b) => !TERMINAL_BATCH_STATUSES.includes(b.status))
    .map((b) => b.id);
  if (openBatchIds.length === 0) return [];

  const all: ImportRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("sponsor_import_rows")
      .select(
        "id, batch_id, raw_company_name, raw_website, normalized_domain, proposed_company_id, match_method, match_confidence, conflict_type, status, decision_type, decision_source, resolved_company_id, decision_by, decision_at",
      )
      .in("batch_id", openBatchIds)
      .not("raw_website", "is", null)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`load import rows failed: ${error.message}`);
    const page = (data ?? []) as ImportRow[];
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return all;
}

export function buildCompanyFindings(rows: CompanyRow[]): CompanyFinding[] {
  const findings: CompanyFinding[] = [];
  for (const row of rows) {
    const website = row.website?.trim() ?? "";
    if (website === "") continue;
    const identity = resolveCompanyWebsiteIdentity(website);
    if (identity.status !== "no_identity") continue;
    if (row.domain === null) continue;
    findings.push({
      id: row.id,
      name: row.name,
      website: row.website,
      current_domain: row.domain,
      resolved_status: "no_identity",
      would_be_domain: null,
      logo_source: row.logo_source,
      company_status: row.status,
    });
  }
  return findings;
}

export function buildUnsafeDomainFindings(rows: CompanyRow[]): UnsafeDomainFinding[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    domain: row.domain,
    website: row.website,
    company_status: row.status,
  }));
}

export function buildCollisionFindings(unsafe: CompanyRow[]): CollisionFinding[] {
  const byDomain = new Map<string, CompanyRow[]>();
  for (const row of unsafe) {
    const domain = row.domain?.trim() ?? "";
    if (domain === "") continue;
    const list = byDomain.get(domain) ?? [];
    list.push(row);
    byDomain.set(domain, list);
  }

  const collisions: CollisionFinding[] = [];
  for (const [domain, list] of byDomain) {
    if (list.length <= 1) continue;
    collisions.push({
      domain,
      company_count: list.length,
      companies: list.map((c) => ({ id: c.id, name: c.name, website: c.website })),
    });
  }
  collisions.sort((a, b) => b.company_count - a.company_count);
  return collisions;
}

export function buildImportFindings(rows: ImportRow[]): ImportFinding[] {
  const findings: ImportFinding[] = [];
  for (const row of rows) {
    const website = row.raw_website?.trim() ?? "";
    if (website === "") continue;
    const identity = resolveCompanyWebsiteIdentity(website);
    if (identity.status !== "no_identity") continue;
    if (row.normalized_domain === null) continue;

    const invalidates_domain_match =
      row.match_method === "domain" || row.proposed_company_id !== null;

    findings.push({
      id: row.id,
      batch_id: row.batch_id,
      raw_company_name: row.raw_company_name,
      raw_website: row.raw_website,
      current_normalized_domain: row.normalized_domain,
      would_be_normalized_domain: null,
      proposed_company_id: row.proposed_company_id,
      match_method: row.match_method,
      match_confidence: row.match_confidence,
      row_status: row.status,
      invalidates_domain_match,
    });
  }
  return findings;
}

export function planCompanyFixes(
  communityWebsiteCompanies: CompanyRow[],
): { plans: CompanyPlan[]; findings: CompanyFinding[] } {
  const findings = buildCompanyFindings(communityWebsiteCompanies);
  const rowById = new Map(communityWebsiteCompanies.map((row) => [row.id, row]));
  const plans: CompanyPlan[] = [];

  for (const finding of findings) {
    const row = rowById.get(finding.id);
    if (!row) continue;
    plans.push({ row, patch: { domain: null } });
  }

  return { plans, findings };
}

export function planImportFixes(openRows: ImportRow[]): {
  plans: ImportPlan[];
  findings: ImportFinding[];
} {
  const findings = buildImportFindings(openRows);
  const rowById = new Map(openRows.map((row) => [row.id, row]));
  const plans: ImportPlan[] = [];

  for (const finding of findings) {
    const row = rowById.get(finding.id);
    if (!row) continue;

    const patch: Record<string, unknown> = {
      normalized_domain: null,
    };

    const clearProposedMatch = row.proposed_company_id !== null;
    const resetResolvedDomainMatch =
      row.status === "resolved" && row.match_method === "domain";

    if (clearProposedMatch) {
      patch.proposed_company_id = null;
    }
    if (row.match_method === "domain") {
      patch.match_method = null;
      patch.match_confidence = null;
    }
    if (row.conflict_type !== null) {
      patch.conflict_type = null;
    }
    if (resetResolvedDomainMatch) {
      patch.status = "needs_review";
      patch.decision_type = null;
      patch.decision_source = null;
      patch.resolved_company_id = null;
      patch.decision_by = null;
      patch.decision_at = null;
    }

    plans.push({
      row,
      patch,
      clearProposedMatch,
      resetResolvedDomainMatch,
    });
  }

  return { plans, findings };
}

export async function scanCommunityIdentity(supabase: Supabase) {
  const communityWebsiteCompanies = await fetchAllCompaniesByWebsiteFilter(supabase);
  const unsafeDomainCompanies = await fetchCompaniesByUnsafeDomain(supabase);
  const openRows = await fetchOpenBatchRows(supabase);

  const companyResult = planCompanyFixes(communityWebsiteCompanies);
  const importResult = planImportFixes(openRows);
  const unsafeDomainFindings = buildUnsafeDomainFindings(unsafeDomainCompanies);
  const collisions = buildCollisionFindings(unsafeDomainCompanies);

  return {
    companyPlans: companyResult.plans,
    companyFindings: companyResult.findings,
    importPlans: importResult.plans,
    importFindings: importResult.findings,
    unsafeDomainFindings,
    collisions,
  };
}
