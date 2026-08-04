import { parseCompanyAliasesFromRow } from "@/src/lib/companies/companyAliases";
import {
  buildImportMatchContext,
  matchImportRowIdentity,
  type ImportMatchCompany,
  type ImportMatchContext,
  type ImportMatchMethod,
} from "@/src/lib/companies/companyImportMatching";
import {
  createSupabaseImportMatchCandidateSource,
  loadImportMatchContextFromCandidateSource,
} from "@/src/lib/companies/importMatchCandidateLoader";
import {
  fetchAllPaginatedSupabaseRows,
  SUPABASE_DEFAULT_PAGE_SIZE,
} from "@/src/lib/supabase/fetchAllPaginatedRows";
import { createAdminClient } from "@/src/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { PartnerAlumniImportRowStatus } from "../types";

export type MatchableRow = {
  id: string;
  status: PartnerAlumniImportRowStatus;
  normalized_domain: string | null;
  normalized_website: string | null;
  normalized_company_name: string | null;
  mapped_display_order: number | null;
  has_blocking_validation: boolean;
};

export type MatchResult = {
  status: PartnerAlumniImportRowStatus;
  match_method: ImportMatchMethod | null;
  match_confidence: "high" | null;
  proposed_company_id: string | null;
  conflict_type: "multiple_candidates" | "domain_name_mismatch" | null;
  already_on_version_member_id: string | null;
  intended_member_action: "create_new_link" | "skip" | "update_order" | null;
};

export type MatchableIdentityRow = Pick<
  MatchableRow,
  "normalized_domain" | "normalized_website" | "normalized_company_name"
>;

export const AUTO_READY_MATCH_METHODS: readonly ImportMatchMethod[] = [
  "domain",
  "alias",
  "website",
];

export function matchesAutoReadyBulkAcceptCriteria(row: {
  status: string;
  match_confidence: string | null;
  match_method: string | null;
}): boolean {
  return (
    row.status === "auto_ready" &&
    row.match_confidence === "high" &&
    row.match_method !== null &&
    (AUTO_READY_MATCH_METHODS as readonly string[]).includes(row.match_method)
  );
}

export const IMPORT_MATCH_CONTEXT_PAGE_SIZE = SUPABASE_DEFAULT_PAGE_SIZE;

export { fetchAllPaginatedSupabaseRows };

/**
 * ARC-003 Phase 5B loader mode for Partner Alumni Import only.
 * Rollback: set PARTNER_ALUMNI_IMPORT_MATCH_LOADER=full_directory (or change default below).
 * Does not affect Partner Alumni Bulk.
 */
export type PartnerAlumniImportMatchLoaderMode = "candidate" | "full_directory";

export function resolvePartnerAlumniImportMatchLoaderMode(
  env: Record<string, string | undefined> = process.env,
): PartnerAlumniImportMatchLoaderMode {
  const raw = env.PARTNER_ALUMNI_IMPORT_MATCH_LOADER?.trim().toLowerCase();
  if (raw === "full_directory" || raw === "full-directory") {
    return "full_directory";
  }
  return "candidate";
}

export const PARTNER_ALUMNI_IMPORT_MATCH_LOADER_MODE: PartnerAlumniImportMatchLoaderMode =
  resolvePartnerAlumniImportMatchLoaderMode();

type CompanyDirectoryRow = {
  id: unknown;
  name: unknown;
  domain: unknown;
  website: unknown;
  aliases: unknown;
};

type CompanyDomainDirectoryRow = {
  company_id: unknown;
  domain: unknown;
};

type VersionMemberRow = {
  id: unknown;
  company_id: unknown;
  display_order: unknown;
};

export function buildImportMatchContextFromDirectory(
  companies: readonly CompanyDirectoryRow[],
  companyDomains: readonly CompanyDomainDirectoryRow[],
): ImportMatchContext {
  const importCompanies: ImportMatchCompany[] = companies.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    domain: typeof row.domain === "string" ? row.domain.trim().toLowerCase() : null,
    website: typeof row.website === "string" ? row.website.trim() : null,
    aliases: parseCompanyAliasesFromRow(row.aliases),
  }));

  const importCompanyDomains = companyDomains
    .map((row) => ({
      company_id: String(row.company_id),
      domain: typeof row.domain === "string" ? row.domain.trim().toLowerCase() : "",
    }))
    .filter((entry) => entry.domain !== "");

  return buildImportMatchContext(importCompanies, importCompanyDomains);
}

function attachVersionMemberFlags(
  row: MatchableRow,
  decision: ReturnType<typeof matchImportRowIdentity>,
  memberByCompanyId: Map<string, { id: string; display_order: number }>,
): MatchResult {
  let already_on_version_member_id: string | null = null;
  let intended_member_action: MatchResult["intended_member_action"] = "create_new_link";

  const companyIdForMember = decision.proposed_company_id;
  if (companyIdForMember) {
    const member = memberByCompanyId.get(companyIdForMember);
    if (member) {
      already_on_version_member_id = member.id;
      const mapped = row.mapped_display_order;
      if (mapped !== null && mapped === member.display_order) {
        intended_member_action = "skip";
      } else {
        intended_member_action = "update_order";
      }
    }
  }

  return {
    status: decision.status,
    match_method: decision.match_method,
    match_confidence: decision.match_confidence,
    proposed_company_id: decision.proposed_company_id,
    conflict_type: decision.conflict_type,
    already_on_version_member_id,
    intended_member_action,
  };
}

export async function matchRow(
  row: MatchableRow,
  context: ImportMatchContext,
  memberByCompanyId: Map<string, { id: string; display_order: number }>,
): Promise<MatchResult> {
  if (row.has_blocking_validation) {
    return {
      status: "needs_review",
      match_method: null,
      match_confidence: null,
      proposed_company_id: null,
      conflict_type: null,
      already_on_version_member_id: null,
      intended_member_action: null,
    };
  }

  const decision = matchImportRowIdentity(
    {
      normalized_domain: row.normalized_domain,
      normalized_website: row.normalized_website,
      normalized_company_name: row.normalized_company_name,
    },
    context,
  );

  return attachVersionMemberFlags(row, decision, memberByCompanyId);
}

async function loadVersionMembersByCompanyId(
  supabase: SupabaseClient,
  versionId: string,
): Promise<Map<string, { id: string; display_order: number }>> {
  const versionMembers = await fetchAllPaginatedSupabaseRows<VersionMemberRow>(
    async ({ from, to }) =>
      supabase
        .from("event_partner_alumni_version_companies")
        .select("id, company_id, display_order")
        .eq("event_partner_alumni_version_id", versionId)
        .range(from, to),
  );

  const memberByCompanyId = new Map<string, { id: string; display_order: number }>();
  for (const member of versionMembers) {
    memberByCompanyId.set(String(member.company_id), {
      id: String(member.id),
      display_order: typeof member.display_order === "number" ? member.display_order : 0,
    });
  }
  return memberByCompanyId;
}

/**
 * Pre-ARC-003 Phase 5B loader: full active companies + all company_domains.
 * Kept for rollback via PARTNER_ALUMNI_IMPORT_MATCH_LOADER=full_directory.
 */
export async function loadFullDirectoryMatchContext(versionId: string): Promise<{
  matchContext: ImportMatchContext;
  memberByCompanyId: Map<string, { id: string; display_order: number }>;
}> {
  const supabase = createAdminClient();

  const [companies, companyDomains, memberByCompanyId] = await Promise.all([
    fetchAllPaginatedSupabaseRows<CompanyDirectoryRow>(async ({ from, to }) =>
      supabase
        .from("companies")
        .select("id, name, domain, website, aliases")
        .eq("status", "active")
        .range(from, to),
    ),
    fetchAllPaginatedSupabaseRows<CompanyDomainDirectoryRow>(async ({ from, to }) =>
      supabase.from("company_domains").select("company_id, domain").range(from, to),
    ),
    loadVersionMembersByCompanyId(supabase, versionId),
  ]);

  const matchContext = buildImportMatchContextFromDirectory(companies, companyDomains);
  return { matchContext, memberByCompanyId };
}

/**
 * ARC-003 Phase 5B candidate loader: ImportMatchContext from DB-backed candidates only.
 * Version-member overlay remains outside the candidate catalog.
 */
export async function loadCandidateMatchContext(
  versionId: string,
  rows: readonly MatchableIdentityRow[],
): Promise<{
  matchContext: ImportMatchContext;
  memberByCompanyId: Map<string, { id: string; display_order: number }>;
}> {
  const supabase = createAdminClient();
  const [matchContext, memberByCompanyId] = await Promise.all([
    loadImportMatchContextFromCandidateSource(
      createSupabaseImportMatchCandidateSource(supabase),
      rows,
    ),
    loadVersionMembersByCompanyId(supabase, versionId),
  ]);
  return { matchContext, memberByCompanyId };
}

/**
 * Production entry for Partner Alumni Import matching context.
 * Phase 5B default: candidate loader. Pass batch identity rows for candidate mode.
 */
export async function loadMatchContext(
  versionId: string,
  rows: readonly MatchableIdentityRow[] = [],
  mode: PartnerAlumniImportMatchLoaderMode = PARTNER_ALUMNI_IMPORT_MATCH_LOADER_MODE,
): Promise<{
  matchContext: ImportMatchContext;
  memberByCompanyId: Map<string, { id: string; display_order: number }>;
}> {
  if (mode === "full_directory") {
    return loadFullDirectoryMatchContext(versionId);
  }
  return loadCandidateMatchContext(versionId, rows);
}
