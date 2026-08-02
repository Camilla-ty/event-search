import {
  matchImportRowIdentity,
  type ImportMatchContext,
} from "@/src/lib/companies/companyImportMatching";
import type {
  ImportMatchShadowPersistedDecision,
  ImportMatchShadowRowInput,
} from "@/src/lib/companies/importMatchShadow/types";
import type { ImportMatchParityImporter } from "@/src/lib/companies/importMatchParity/types";
import { matchRow as matchExhibitorRow } from "@/src/features/exhibitor-import/server/matchRows";
import { matchRow as matchPartnerAlumniRow } from "@/src/features/partner-alumni-import/server/matchRows";
import { matchRow as matchSponsorRow } from "@/src/features/sponsor-import/server/matchRows";

export type ShadowLiveOverlays = {
  liveSponsorsByCompanyId?: ReadonlyMap<string, { id: string; tier_rank: number | null }>;
  liveExhibitorsByCompanyId?: ReadonlyMap<string, { id: string; tier_rank: number | null }>;
  versionMembersByCompanyId?: ReadonlyMap<string, { id: string; display_order: number }>;
  /** Partner Alumni bulk: company ids already on the version roster. */
  rosterCompanyIds?: ReadonlySet<string>;
};

function emptyPersisted(
  rowId: string,
  importer: ImportMatchParityImporter,
): ImportMatchShadowPersistedDecision {
  return {
    row_id: rowId,
    importer,
    status: "needs_review",
    match_method: null,
    match_confidence: null,
    proposed_company_id: null,
    conflict_type: null,
    intended_link_action: null,
    already_on_live_sponsor_id: null,
    already_on_live_exhibitor_id: null,
    already_on_live_tier_rank: null,
    intended_member_action: null,
    already_on_version_member_id: null,
    bulk_preview_status: null,
  };
}

function bulkPreviewStatus(params: {
  decision: ReturnType<typeof matchImportRowIdentity>;
  duplicateKind: "identity_key" | "company_id" | null;
  on_roster: boolean;
}): NonNullable<ImportMatchShadowPersistedDecision["bulk_preview_status"]> {
  if (params.duplicateKind === "identity_key" || params.duplicateKind === "company_id") {
    return "duplicate_in_file";
  }
  if (params.on_roster && params.decision.proposed_company_id !== null) {
    return "on_roster";
  }
  if (params.decision.status === "auto_ready" && params.decision.proposed_company_id) {
    return "matched";
  }
  if (params.decision.proposed_company_id) {
    return "review";
  }
  return "create_new";
}

/**
 * Produce the persisted matching decision for one row against a given context.
 * Read-only — does not write to the database.
 */
export async function runImportMatchShadowRow(params: {
  importer: ImportMatchParityImporter;
  row: ImportMatchShadowRowInput;
  context: ImportMatchContext;
  overlays?: ShadowLiveOverlays;
}): Promise<ImportMatchShadowPersistedDecision> {
  const { importer, row, context, overlays } = params;
  const blocking = Boolean(row.has_blocking_validation);

  if (importer === "sponsor") {
    const result = await matchSponsorRow(
      {
        id: row.id,
        status: "needs_review",
        normalized_domain: row.normalized_domain,
        normalized_website: row.normalized_website,
        normalized_company_name: row.normalized_company_name,
        mapped_tier_rank: row.mapped_tier_rank ?? null,
        has_blocking_validation: blocking,
      },
      context,
      new Map(overlays?.liveSponsorsByCompanyId ?? []),
    );
    return {
      ...emptyPersisted(row.id, importer),
      status: result.status,
      match_method: result.match_method,
      match_confidence: result.match_confidence,
      proposed_company_id: result.proposed_company_id,
      conflict_type: result.conflict_type,
      intended_link_action: result.intended_link_action,
      already_on_live_sponsor_id: result.already_on_live_sponsor_id,
      already_on_live_tier_rank: result.already_on_live_tier_rank,
    };
  }

  if (importer === "exhibitor") {
    const result = await matchExhibitorRow(
      {
        id: row.id,
        status: "needs_review",
        normalized_domain: row.normalized_domain,
        normalized_website: row.normalized_website,
        normalized_company_name: row.normalized_company_name,
        mapped_tier_rank: row.mapped_tier_rank ?? null,
        has_blocking_validation: blocking,
      },
      context,
      new Map(overlays?.liveExhibitorsByCompanyId ?? []),
    );
    return {
      ...emptyPersisted(row.id, importer),
      status: result.status,
      match_method: result.match_method,
      match_confidence: result.match_confidence,
      proposed_company_id: result.proposed_company_id,
      conflict_type: result.conflict_type,
      intended_link_action: result.intended_link_action,
      already_on_live_exhibitor_id: result.already_on_live_exhibitor_id,
      already_on_live_tier_rank: result.already_on_live_tier_rank,
    };
  }

  if (importer === "partner_alumni") {
    const result = await matchPartnerAlumniRow(
      {
        id: row.id,
        status: "needs_review",
        normalized_domain: row.normalized_domain,
        normalized_website: row.normalized_website,
        normalized_company_name: row.normalized_company_name,
        mapped_display_order: row.mapped_display_order ?? null,
        has_blocking_validation: blocking,
      },
      context,
      new Map(overlays?.versionMembersByCompanyId ?? []),
    );
    return {
      ...emptyPersisted(row.id, importer),
      status: result.status,
      match_method: result.match_method,
      match_confidence: result.match_confidence,
      proposed_company_id: result.proposed_company_id,
      conflict_type: result.conflict_type,
      intended_member_action: result.intended_member_action,
      already_on_version_member_id: result.already_on_version_member_id,
    };
  }

  // partner_alumni_bulk — mirrors preview decision core (no DB writes)
  if (blocking) {
    return {
      ...emptyPersisted(row.id, importer),
      status: "invalid",
      bulk_preview_status: "invalid",
    };
  }

  const duplicateKind =
    row.duplicate_in_file_kind ??
    (row.duplicate_in_file ? ("company_id" as const) : null);

  if (duplicateKind === "identity_key") {
    return {
      ...emptyPersisted(row.id, importer),
      status: "duplicate_in_file",
      bulk_preview_status: "duplicate_in_file",
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

  if (duplicateKind === "company_id") {
    return {
      ...emptyPersisted(row.id, importer),
      status: "duplicate_in_file",
      bulk_preview_status: "duplicate_in_file",
      match_method: decision.match_method,
      match_confidence: decision.match_confidence,
      proposed_company_id: decision.proposed_company_id,
      conflict_type: decision.conflict_type,
    };
  }

  const onRoster =
    Boolean(row.on_roster) ||
    (decision.proposed_company_id !== null &&
      Boolean(overlays?.rosterCompanyIds?.has(decision.proposed_company_id)));

  const status = bulkPreviewStatus({
    decision,
    duplicateKind: null,
    on_roster: onRoster,
  });

  return {
    ...emptyPersisted(row.id, importer),
    status,
    bulk_preview_status: status,
    match_method: decision.match_method,
    match_confidence: decision.match_confidence,
    proposed_company_id: decision.proposed_company_id,
    conflict_type: decision.conflict_type,
  };
}
