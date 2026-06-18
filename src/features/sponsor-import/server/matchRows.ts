import { parseCompanyAliasesFromRow } from "@/src/lib/companies/companyAliases";
import {
  buildImportMatchContext,
  matchImportRowIdentity,
  type ImportMatchCompany,
  type ImportMatchContext,
  type ImportMatchMethod,
} from "@/src/lib/companies/companyImportMatching";
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
  match_method: ImportMatchMethod | null;
  match_confidence: "high" | null;
  proposed_company_id: string | null;
  conflict_type: "multiple_candidates" | "domain_name_mismatch" | null;
  already_on_live_sponsor_id: string | null;
  already_on_live_tier_rank: number | null;
  intended_link_action: "create_new_link" | "update_tier" | "skip" | null;
};

export const AUTO_READY_MATCH_METHODS: readonly ImportMatchMethod[] = ["domain"];

function attachLiveEditionFlags(
  row: MatchableRow,
  decision: ReturnType<typeof matchImportRowIdentity>,
  liveByCompanyId: Map<string, { id: string; tier_rank: number | null }>,
): MatchResult {
  let already_on_live_sponsor_id: string | null = null;
  let already_on_live_tier_rank: number | null = null;
  let intended_link_action: MatchResult["intended_link_action"] = "create_new_link";

  const companyIdForLive = decision.proposed_company_id;
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
    status: decision.status,
    match_method: decision.match_method,
    match_confidence: decision.match_confidence,
    proposed_company_id: decision.proposed_company_id,
    conflict_type: decision.conflict_type,
    already_on_live_sponsor_id,
    already_on_live_tier_rank,
    intended_link_action,
  };
}

export async function matchRow(
  row: MatchableRow,
  context: ImportMatchContext,
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

  const decision = matchImportRowIdentity(
    {
      normalized_domain: row.normalized_domain,
      normalized_company_name: row.normalized_company_name,
    },
    context,
  );

  return attachLiveEditionFlags(row, decision, liveByCompanyId);
}

export async function loadMatchContext(eventEditionId: string): Promise<{
  matchContext: ImportMatchContext;
  liveByCompanyId: Map<string, { id: string; tier_rank: number | null }>;
}> {
  const supabase = createAdminClient();

  const { data: companies, error: companyError } = await supabase
    .from("companies")
    .select("id, name, domain, aliases");

  if (companyError) {
    throw new Error(companyError.message);
  }

  const importCompanies: ImportMatchCompany[] = (companies ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    domain: typeof row.domain === "string" ? row.domain.trim().toLowerCase() : null,
    aliases: parseCompanyAliasesFromRow(row.aliases),
  }));

  const matchContext = buildImportMatchContext(importCompanies);

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
      tier_rank: typeof link.tier_rank === "number" ? link.tier_rank : null,
    });
  }

  return { matchContext, liveByCompanyId };
}
