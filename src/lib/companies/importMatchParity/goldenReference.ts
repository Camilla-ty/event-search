import {
  buildImportMatchContext,
  matchImportRowIdentity,
  type ImportMatchCompany,
  type ImportMatchCompanyDomain,
  type ImportMatchContext,
} from "@/src/lib/companies/companyImportMatching";
import { listImportMatchCandidateCompanyIds } from "@/src/lib/companies/importMatchParity/candidates";
import type {
  ImportMatchParityClusterBatch,
  ImportMatchParityDecision,
  ImportMatchParityImporter,
  ImportMatchParityLiveExhibitor,
  ImportMatchParityLiveSponsor,
  ImportMatchParityRowInput,
  ImportMatchParityVersionMember,
} from "@/src/lib/companies/importMatchParity/types";
import { matchRow as matchExhibitorRow } from "@/src/features/exhibitor-import/server/matchRows";
import { assignDuplicateClusters as assignExhibitorDuplicateClusters } from "@/src/features/exhibitor-import/server/validateRows";
import { matchRow as matchPartnerAlumniRow } from "@/src/features/partner-alumni-import/server/matchRows";
import { matchRow as matchSponsorRow } from "@/src/features/sponsor-import/server/matchRows";
import { assignDuplicateClusters as assignSponsorDuplicateClusters } from "@/src/features/sponsor-import/server/validateRows";

export type GoldenDirectory = {
  companies: readonly ImportMatchCompany[];
  companyDomains?: readonly ImportMatchCompanyDomain[];
  /**
   * Present in DB but excluded from match context (mirrors status=active loader filter).
   * Not passed to buildImportMatchContext.
   */
  inactiveCompanies?: readonly ImportMatchCompany[];
};

export type GoldenReferenceInput = {
  fixture_id: string;
  importer: ImportMatchParityImporter;
  directory: GoldenDirectory;
  row: ImportMatchParityRowInput;
  /** Optional live overlay keyed by company id. */
  liveSponsorsByCompanyId?: ReadonlyMap<string, ImportMatchParityLiveSponsor>;
  liveExhibitorsByCompanyId?: ReadonlyMap<string, ImportMatchParityLiveExhibitor>;
  versionMembersByCompanyId?: ReadonlyMap<string, ImportMatchParityVersionMember>;
  /** Partner Alumni bulk: company already on version roster. */
  on_roster?: boolean;
  /**
   * Partner Alumni bulk duplicate flag.
   * Prefer `duplicate_in_file_kind` when distinguishing identity-key vs company-id paths.
   */
  duplicate_in_file?: boolean;
  /**
   * Partner Alumni bulk: which production duplicate path to mirror.
   * - identity_key: same name+domain seen earlier → match fields cleared
   * - company_id: same proposed company id seen earlier → match fields retained
   */
  duplicate_in_file_kind?: "identity_key" | "company_id";
  /** Sponsor / exhibitor: batch used to lock assignDuplicateClusters fields. */
  cluster_batch?: ImportMatchParityClusterBatch;
};

function companyNameById(directory: GoldenDirectory): Map<string, string> {
  return new Map(directory.companies.map((company) => [company.id, company.name]));
}

function buildContext(directory: GoldenDirectory): ImportMatchContext {
  // inactiveCompanies intentionally omitted — production loaders only select status=active.
  return buildImportMatchContext(directory.companies, directory.companyDomains ?? []);
}

function emptyClusterFields(): Pick<
  ImportMatchParityDecision,
  | "duplicate_cluster_key"
  | "duplicate_role"
  | "duplicate_of_row_id"
  | "duplicate_resolution"
> {
  return {
    duplicate_cluster_key: null,
    duplicate_role: null,
    duplicate_of_row_id: null,
    duplicate_resolution: null,
  };
}

function emptyDecisionBase(
  input: GoldenReferenceInput,
  candidates: string[],
): Omit<ImportMatchParityDecision, "status" | "persisted"> & {
  status: string;
} {
  return {
    fixture_id: input.fixture_id,
    importer: input.importer,
    status: "needs_review",
    proposed_company_id: null,
    proposed_company_name: null,
    match_method: null,
    match_confidence: null,
    conflict_type: null,
    intended_link_action: null,
    already_on_live_sponsor_id: null,
    already_on_live_exhibitor_id: null,
    already_on_live_tier_rank: null,
    intended_member_action: null,
    already_on_version_member_id: null,
    create_new_decision: true,
    bulk_preview_status: null,
    candidate_company_ids: candidates,
    candidate_ordering: [...candidates],
    duplicate_in_file: Boolean(
      input.duplicate_in_file || input.duplicate_in_file_kind !== undefined,
    ),
    on_roster: Boolean(input.on_roster),
    ...emptyClusterFields(),
  };
}

function withPersisted(decision: Omit<ImportMatchParityDecision, "persisted">): ImportMatchParityDecision {
  return {
    ...decision,
    persisted: {
      status: decision.status,
      match_method: decision.match_method,
      match_confidence: decision.match_confidence,
      proposed_company_id: decision.proposed_company_id,
      conflict_type: decision.conflict_type,
      intended_link_action: decision.intended_link_action,
      intended_member_action: decision.intended_member_action,
      already_on_live_sponsor_id: decision.already_on_live_sponsor_id,
      already_on_live_exhibitor_id: decision.already_on_live_exhibitor_id,
      already_on_live_tier_rank: decision.already_on_live_tier_rank,
      already_on_version_member_id: decision.already_on_version_member_id,
      duplicate_cluster_key: decision.duplicate_cluster_key,
      duplicate_role: decision.duplicate_role,
      duplicate_of_row_id: decision.duplicate_of_row_id,
      duplicate_resolution: decision.duplicate_resolution,
    },
  };
}

function resolveBulkDuplicateKind(
  input: GoldenReferenceInput,
): "identity_key" | "company_id" | null {
  if (input.duplicate_in_file_kind) return input.duplicate_in_file_kind;
  if (input.duplicate_in_file) return "company_id";
  return null;
}

function bulkPreviewStatusFromDecision(params: {
  decision: ReturnType<typeof matchImportRowIdentity>;
  duplicateKind: "identity_key" | "company_id" | null;
  on_roster: boolean;
}): NonNullable<ImportMatchParityDecision["bulk_preview_status"]> {
  if (params.duplicateKind) return "duplicate_in_file";
  if (
    params.on_roster &&
    params.decision.proposed_company_id !== null
  ) {
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

function applyClusterFields(
  decision: Omit<ImportMatchParityDecision, "persisted">,
  input: GoldenReferenceInput,
): Omit<ImportMatchParityDecision, "persisted"> {
  if (!input.cluster_batch) return decision;
  if (input.importer !== "sponsor" && input.importer !== "exhibitor") {
    return decision;
  }

  const assign =
    input.importer === "sponsor"
      ? assignSponsorDuplicateClusters
      : assignExhibitorDuplicateClusters;

  const validated = input.cluster_batch.rows.map((row) => ({
    id: row.id,
    excel_row_number: row.excel_row_number,
    status: row.status ?? "needs_review",
    normalized_company_name: row.normalized_company_name,
    normalized_website: row.normalized_website,
    normalized_domain: row.normalized_domain,
    proposed_slug: null,
    mapped_tier_rank: row.mapped_tier_rank,
    mapped_tier_label: null,
    validation_issues: [],
    has_blocking_validation: Boolean(row.has_blocking_validation),
    duplicate_cluster_key: null,
    duplicate_role: null,
    duplicate_of_row_id: null,
    duplicate_resolution: null,
  }));

  const clustered = assign(validated);
  const subject = clustered.find((row) => row.id === input.cluster_batch!.subject_row_id);
  if (!subject) {
    throw new Error(
      `cluster_batch subject_row_id "${input.cluster_batch.subject_row_id}" not found in batch`,
    );
  }

  return {
    ...decision,
    duplicate_cluster_key: subject.duplicate_cluster_key,
    duplicate_role: subject.duplicate_role,
    duplicate_of_row_id: subject.duplicate_of_row_id,
    duplicate_resolution: subject.duplicate_resolution,
  };
}

/**
 * Golden reference runner — current production matching only.
 * Does not change production behavior; used exclusively for Phase 0 locking / later parity.
 */
export async function runGoldenImportMatchParity(
  input: GoldenReferenceInput,
): Promise<ImportMatchParityDecision> {
  const context = buildContext(input.directory);
  const names = companyNameById(input.directory);
  const matchable = {
    normalized_domain: input.row.normalized_domain,
    normalized_website: input.row.normalized_website,
    normalized_company_name: input.row.normalized_company_name,
  };
  const candidates = listImportMatchCandidateCompanyIds(matchable, context);
  const blocking = Boolean(input.row.has_blocking_validation);
  const duplicateKind = resolveBulkDuplicateKind(input);

  if (input.importer === "partner_alumni_bulk" && blocking) {
    // Bulk preview has no has_blocking_validation column; empty/invalid rows map to invalid.
    const blocked = emptyDecisionBase(input, candidates);
    blocked.status = "invalid";
    blocked.bulk_preview_status = "invalid";
    blocked.create_new_decision = false;
    return withPersisted(blocked);
  }

  if (input.importer === "partner_alumni_bulk" && duplicateKind === "identity_key") {
    // Mirrors seenIdentityKeys short-circuit in previewPartnerAlumniBulkImport.
    const dup = emptyDecisionBase(input, candidates);
    dup.create_new_decision = false;
    dup.bulk_preview_status = "duplicate_in_file";
    dup.status = "duplicate_in_file";
    dup.duplicate_in_file = true;
    return withPersisted(dup);
  }

  if (input.importer === "partner_alumni_bulk" && duplicateKind === "company_id") {
    // Mirrors seenCompanyIds short-circuit (match fields retained from engine).
    const dup = emptyDecisionBase(input, candidates);
    const engine = matchImportRowIdentity(matchable, context);
    dup.match_method = engine.match_method;
    dup.match_confidence = engine.match_confidence;
    dup.conflict_type = engine.conflict_type;
    dup.proposed_company_id = engine.proposed_company_id;
    dup.proposed_company_name =
      engine.proposed_company_id !== null
        ? (names.get(engine.proposed_company_id) ?? null)
        : null;
    dup.create_new_decision = false;
    dup.bulk_preview_status = "duplicate_in_file";
    dup.status = "duplicate_in_file";
    dup.duplicate_in_file = true;
    return withPersisted(dup);
  }

  if (input.importer === "sponsor") {
    const result = await matchSponsorRow(
      {
        id: input.fixture_id,
        status: "needs_review",
        normalized_domain: input.row.normalized_domain,
        normalized_website: input.row.normalized_website,
        normalized_company_name: input.row.normalized_company_name,
        mapped_tier_rank: input.row.mapped_tier_rank ?? null,
        has_blocking_validation: blocking,
      },
      context,
      new Map(input.liveSponsorsByCompanyId ?? []),
    );
    const decision = applyClusterFields(
      {
        ...emptyDecisionBase(input, candidates),
        status: result.status,
        proposed_company_id: result.proposed_company_id,
        proposed_company_name:
          result.proposed_company_id !== null
            ? (names.get(result.proposed_company_id) ?? null)
            : null,
        match_method: result.match_method,
        match_confidence: result.match_confidence,
        conflict_type: result.conflict_type,
        intended_link_action: result.intended_link_action,
        already_on_live_sponsor_id: result.already_on_live_sponsor_id,
        already_on_live_tier_rank: result.already_on_live_tier_rank,
        // Blocking clears proposals but is not a create-new import decision.
        create_new_decision: blocking ? false : result.proposed_company_id === null,
      },
      input,
    );
    return withPersisted(decision);
  }

  if (input.importer === "exhibitor") {
    const result = await matchExhibitorRow(
      {
        id: input.fixture_id,
        status: "needs_review",
        normalized_domain: input.row.normalized_domain,
        normalized_website: input.row.normalized_website,
        normalized_company_name: input.row.normalized_company_name,
        mapped_tier_rank: input.row.mapped_tier_rank ?? null,
        has_blocking_validation: blocking,
      },
      context,
      new Map(input.liveExhibitorsByCompanyId ?? []),
    );
    const decision = applyClusterFields(
      {
        ...emptyDecisionBase(input, candidates),
        status: result.status,
        proposed_company_id: result.proposed_company_id,
        proposed_company_name:
          result.proposed_company_id !== null
            ? (names.get(result.proposed_company_id) ?? null)
            : null,
        match_method: result.match_method,
        match_confidence: result.match_confidence,
        conflict_type: result.conflict_type,
        intended_link_action: result.intended_link_action,
        already_on_live_exhibitor_id: result.already_on_live_exhibitor_id,
        already_on_live_tier_rank: result.already_on_live_tier_rank,
        create_new_decision: blocking ? false : result.proposed_company_id === null,
      },
      input,
    );
    return withPersisted(decision);
  }

  if (input.importer === "partner_alumni") {
    const result = await matchPartnerAlumniRow(
      {
        id: input.fixture_id,
        status: "needs_review",
        normalized_domain: input.row.normalized_domain,
        normalized_website: input.row.normalized_website,
        normalized_company_name: input.row.normalized_company_name,
        mapped_display_order: input.row.mapped_display_order ?? null,
        has_blocking_validation: blocking,
      },
      context,
      new Map(input.versionMembersByCompanyId ?? []),
    );
    return withPersisted({
      ...emptyDecisionBase(input, candidates),
      status: result.status,
      proposed_company_id: result.proposed_company_id,
      proposed_company_name:
        result.proposed_company_id !== null
          ? (names.get(result.proposed_company_id) ?? null)
          : null,
      match_method: result.match_method,
      match_confidence: result.match_confidence,
      conflict_type: result.conflict_type,
      intended_member_action: result.intended_member_action,
      already_on_version_member_id: result.already_on_version_member_id,
      create_new_decision: blocking ? false : result.proposed_company_id === null,
    });
  }

  // partner_alumni_bulk — mirrors previewPartnerAlumniBulkImport decision core
  const decision = matchImportRowIdentity(matchable, context);
  const bulkStatus = bulkPreviewStatusFromDecision({
    decision,
    duplicateKind,
    on_roster: Boolean(input.on_roster),
  });
  const proposedId = decision.proposed_company_id;

  return withPersisted({
    ...emptyDecisionBase(input, candidates),
    status: bulkStatus,
    proposed_company_id: proposedId,
    proposed_company_name:
      proposedId !== null ? (names.get(proposedId) ?? null) : null,
    match_method: decision.match_method,
    match_confidence: decision.match_confidence,
    conflict_type: decision.conflict_type,
    create_new_decision: bulkStatus === "create_new",
    bulk_preview_status: bulkStatus,
    on_roster: bulkStatus === "on_roster",
    duplicate_in_file: bulkStatus === "duplicate_in_file",
  });
}
