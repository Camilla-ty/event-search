import {
  normalizeDomainFromWebsite,
} from "@/src/features/companies/server/createCompanyWithLogo";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Existing import conflict value used when a shared name must be decided by an admin. */
export const DUPLICATE_COMPANY_NAME_CONFLICT = "uniqueness_violation";

export type DuplicateNameReviewReason =
  | "same_name_different_domain"
  | "same_name_no_domain";

export type CompanyNameLookup = {
  domain: string | null;
  sameNameCompanyIds: string[];
  sameDomainCompanyId: string | null;
};

export type CompanyCreateDecision =
  | { action: "reuse"; companyId: string }
  | { action: "create" }
  | {
      action: "review";
      reason: DuplicateNameReviewReason;
      candidateIds: string[];
    };

export type CompanyCreateResolution =
  | { companyId: string; created: boolean }
  | {
      needsReview: true;
      reason: DuplicateNameReviewReason;
      candidateIds: string[];
    };

export function companyNameDomainCacheKey(
  name: string,
  domain: string | null | undefined,
): string | null {
  const normalizedName = name.trim().toLowerCase();
  const normalizedDomain = domain?.trim().toLowerCase() ?? "";
  if (normalizedName === "" || normalizedDomain === "") return null;
  return `${normalizedName}\n${normalizedDomain}`;
}

export function decideCompanyCreate(input: {
  domain: string | null;
  sameNameCompanyIds: readonly string[];
  sameDomainCompanyId: string | null;
  explicitCreate: boolean;
}): CompanyCreateDecision {
  const domain = input.domain?.trim().toLowerCase() || null;
  if (domain && input.sameDomainCompanyId) {
    return { action: "reuse", companyId: input.sameDomainCompanyId };
  }

  const sameNameCompanyIds = input.sameNameCompanyIds.filter((id) => id.trim() !== "");
  if (sameNameCompanyIds.length > 0) {
    if (input.explicitCreate) {
      return { action: "create" };
    }
    return {
      action: "review",
      reason: domain ? "same_name_different_domain" : "same_name_no_domain",
      candidateIds: sameNameCompanyIds,
    };
  }

  return { action: "create" };
}

/**
 * A saved Create new decision is the administrator's confirmation.
 * A later matching refresh may clear conflict_type; that does not cancel the decision.
 */
export function isExplicitDuplicateNameCreate(row: {
  decision_type?: string | null;
  conflict_type?: string | null;
}): boolean {
  return row.decision_type === "create_new";
}

export const DUPLICATE_NAME_IMPORT_STOPPED_MESSAGE =
  "Some rows use a company name that already exists with a different website, or no website. They were returned to review. Refresh this page, then choose the existing company or create a new one.";

export function duplicateNameReviewMessage(reason: DuplicateNameReviewReason): string {
  if (reason === "same_name_no_domain") {
    return "A company with this name already exists and this row has no website. Choose the existing company or create a new one.";
  }
  return "A company with this name already exists with a different website. Choose the existing company or create a new one.";
}

export function isCompanyCreateNeedsReview(
  value: CompanyCreateResolution,
): value is Extract<CompanyCreateResolution, { needsReview: true }> {
  return "needsReview" in value && value.needsReview === true;
}

export function duplicateNameReviewPatch(resolution: {
  reason: DuplicateNameReviewReason;
  candidateIds: readonly string[];
}): Record<string, unknown> {
  const proposed =
    resolution.candidateIds.length === 1 ? resolution.candidateIds[0] : null;
  return {
    status: "needs_review",
    decision_type: null,
    decision_source: null,
    decision_by: null,
    decision_at: null,
    resolved_company_id: null,
    proposed_company_id: proposed,
    match_method: "exact_name",
    match_confidence: null,
    conflict_type: DUPLICATE_COMPANY_NAME_CONFLICT,
    import_error: duplicateNameReviewMessage(resolution.reason),
    updated_at: new Date().toISOString(),
  };
}

function escapeIlikeExact(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export async function lookupCompanyNameAndDomain(
  supabase: SupabaseClient,
  name: string,
  website: string | null,
): Promise<CompanyNameLookup> {
  const trimmedName = name.trim();
  const domain = website ? normalizeDomainFromWebsite(website) : null;
  const sameNameCompanyIds: string[] = [];

  if (trimmedName !== "") {
    const { data, error } = await supabase
      .from("companies")
      .select("id")
      .ilike("name", escapeIlikeExact(trimmedName));
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      if (row.id) sameNameCompanyIds.push(String(row.id));
    }
  }

  let sameDomainCompanyId: string | null = null;
  if (domain) {
    const { data, error } = await supabase
      .from("companies")
      .select("id")
      .eq("domain", domain)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.id) sameDomainCompanyId = String(data.id);

    if (!sameDomainCompanyId) {
      const { data: domainRow, error: domainError } = await supabase
        .from("company_domains")
        .select("company_id")
        .eq("domain", domain)
        .maybeSingle();
      if (domainError) throw new Error(domainError.message);
      if (domainRow?.company_id) sameDomainCompanyId = String(domainRow.company_id);
    }
  }

  return { domain, sameNameCompanyIds, sameDomainCompanyId };
}

function isCompanyUniqueViolation(message: string): boolean {
  return message.includes("duplicate key") || message.includes("unique constraint");
}

/**
 * Reuse only when the domain already belongs to a company.
 * A shared name with a different domain, or no domain, stays in review
 * unless the admin has already confirmed a separate company.
 * The cache key includes the domain, and rows with no domain are not cached.
 */
export async function resolveCompanyCreate(input: {
  supabase: SupabaseClient;
  name: string;
  website: string | null;
  explicitCreate: boolean;
  cache: Map<string, string>;
  create: () => Promise<{ id: string }>;
}): Promise<CompanyCreateResolution> {
  const domain = input.website ? normalizeDomainFromWebsite(input.website) : null;
  const cacheKey = companyNameDomainCacheKey(input.name, domain);
  if (cacheKey) {
    const cached = input.cache.get(cacheKey);
    if (cached) return { companyId: cached, created: false };
  }

  const found = await lookupCompanyNameAndDomain(input.supabase, input.name, input.website);
  const decision = decideCompanyCreate({
    domain: found.domain,
    sameNameCompanyIds: found.sameNameCompanyIds,
    sameDomainCompanyId: found.sameDomainCompanyId,
    explicitCreate: input.explicitCreate,
  });

  if (decision.action === "reuse") {
    if (cacheKey) input.cache.set(cacheKey, decision.companyId);
    return { companyId: decision.companyId, created: false };
  }

  if (decision.action === "review") {
    return {
      needsReview: true,
      reason: decision.reason,
      candidateIds: decision.candidateIds,
    };
  }

  try {
    const created = await input.create();
    if (cacheKey) input.cache.set(cacheKey, created.id);
    return { companyId: created.id, created: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!isCompanyUniqueViolation(message)) {
      throw error instanceof Error ? error : new Error(message);
    }

    const raced = await lookupCompanyNameAndDomain(input.supabase, input.name, input.website);
    const racedDecision = decideCompanyCreate({
      domain: raced.domain,
      sameNameCompanyIds: raced.sameNameCompanyIds,
      sameDomainCompanyId: raced.sameDomainCompanyId,
      explicitCreate: false,
    });
    if (racedDecision.action === "reuse") {
      if (cacheKey) input.cache.set(cacheKey, racedDecision.companyId);
      return { companyId: racedDecision.companyId, created: false };
    }
    if (racedDecision.action === "review" && !input.explicitCreate) {
      return {
        needsReview: true,
        reason: racedDecision.reason,
        candidateIds: racedDecision.candidateIds,
      };
    }
    throw error instanceof Error ? error : new Error(message);
  }
}
