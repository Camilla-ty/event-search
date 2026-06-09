import { createAdminClient } from "@/src/lib/supabase/admin";

import type { SponsorImportRowStatus } from "../types";

export type MatchableRow = {
  id: string;
  status: SponsorImportRowStatus;
  normalized_domain: string | null;
  normalized_company_name: string | null;
  mapped_tier_rank: number | null;
  has_blocking_validation: boolean;
};

export type MatchResult = {
  status: SponsorImportRowStatus;
  match_method: "domain" | null;
  match_confidence: "high" | null;
  proposed_company_id: string | null;
  conflict_type: "multiple_candidates" | "domain_name_mismatch" | null;
  already_on_live_sponsor_id: string | null;
  already_on_live_tier_rank: number | null;
  intended_link_action: "create_new_link" | "update_tier" | "skip" | null;
};

function nameSimilarity(a: string, b: string): boolean {
  const na = a.trim().toLowerCase();
  const nb = b.trim().toLowerCase();
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  return false;
}

export async function matchRow(
  row: MatchableRow,
  eventEditionId: string,
  companiesByDomain: Map<string, Array<{ id: string; name: string; domain: string }>>,
  liveByCompanyId: Map<string, { id: string; tier_rank: number | null }>,
): Promise<MatchResult> {
  if (row.has_blocking_validation) {
    return {
      status: "needs_review",
      match_method: null,
      match_confidence: null,
      proposed_company_id: null,
      conflict_type: null,
      already_on_live_sponsor_id: null,
      already_on_live_tier_rank: null,
      intended_link_action: null,
    };
  }

  const domain = row.normalized_domain?.toLowerCase() ?? null;
  if (!domain) {
    return {
      status: "needs_review",
      match_method: null,
      match_confidence: null,
      proposed_company_id: null,
      conflict_type: null,
      already_on_live_sponsor_id: null,
      already_on_live_tier_rank: null,
      intended_link_action: "create_new_link",
    };
  }

  const candidates = companiesByDomain.get(domain) ?? [];
  let status: SponsorImportRowStatus = "needs_review";
  let proposed_company_id: string | null = null;
  let conflict_type: MatchResult["conflict_type"] = null;

  if (candidates.length === 1) {
    const candidate = candidates[0];
    if (!candidate) {
      status = "needs_review";
    } else {
      proposed_company_id = candidate.id;
      const rowName = row.normalized_company_name ?? "";
      if (rowName && !nameSimilarity(rowName, candidate.name)) {
        status = "needs_review";
        conflict_type = "domain_name_mismatch";
      } else {
        status = "auto_ready";
      }
    }
  } else if (candidates.length > 1) {
    status = "needs_review";
    conflict_type = "multiple_candidates";
  } else {
    status = "needs_review";
  }

  let already_on_live_sponsor_id: string | null = null;
  let already_on_live_tier_rank: number | null = null;
  let intended_link_action: MatchResult["intended_link_action"] = "create_new_link";

  const companyIdForLive = proposed_company_id;
  if (companyIdForLive) {
    const live = liveByCompanyId.get(companyIdForLive);
    if (live) {
      already_on_live_sponsor_id = live.id;
      already_on_live_tier_rank = live.tier_rank;
      const mapped = row.mapped_tier_rank;
      if (mapped !== null && live.tier_rank !== null && mapped === live.tier_rank) {
        intended_link_action = "skip";
      } else {
        intended_link_action = "update_tier";
      }
    }
  }

  return {
    status,
    match_method: status === "auto_ready" ? "domain" : null,
    match_confidence: status === "auto_ready" ? "high" : null,
    proposed_company_id,
    conflict_type,
    already_on_live_sponsor_id,
    already_on_live_tier_rank,
    intended_link_action,
  };
}

export async function loadMatchContext(eventEditionId: string): Promise<{
  companiesByDomain: Map<string, Array<{ id: string; name: string; domain: string }>>;
  liveByCompanyId: Map<string, { id: string; tier_rank: number | null }>;
}> {
  const supabase = createAdminClient();

  const { data: companies, error: companyError } = await supabase
    .from("companies")
    .select("id, name, domain")
    .not("domain", "is", null);

  if (companyError) {
    throw new Error(companyError.message);
  }

  const companiesByDomain = new Map<string, Array<{ id: string; name: string; domain: string }>>();
  for (const c of companies ?? []) {
    const domain =
      typeof c.domain === "string" ? c.domain.trim().toLowerCase() : "";
    if (!domain) continue;
    const list = companiesByDomain.get(domain) ?? [];
    list.push({
      id: String(c.id),
      name: String(c.name),
      domain,
    });
    companiesByDomain.set(domain, list);
  }

  const { data: liveLinks, error: liveError } = await supabase
    .from("event_sponsors")
    .select("id, company_id, tier_rank")
    .eq("event_editions_id", eventEditionId);

  if (liveError) {
    throw new Error(liveError.message);
  }

  const liveByCompanyId = new Map<string, { id: string; tier_rank: number | null }>();
  for (const link of liveLinks ?? []) {
    const companyId = String(link.company_id);
    liveByCompanyId.set(companyId, {
      id: String(link.id),
      tier_rank:
        typeof link.tier_rank === "number" ? link.tier_rank : null,
    });
  }

  return { companiesByDomain, liveByCompanyId };
}
