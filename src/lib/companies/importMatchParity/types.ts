import type {
  ImportMatchConflictType,
  ImportMatchMethod,
} from "@/src/lib/companies/companyImportMatching";

/** Which import surface a parity decision was produced for. */
export type ImportMatchParityImporter =
  | "sponsor"
  | "exhibitor"
  | "partner_alumni"
  | "partner_alumni_bulk";

/**
 * Canonical comparison object for ARC-003 parity.
 * One differing field must fail the deep assert.
 */
export type ImportMatchParityDecision = {
  fixture_id: string;
  importer: ImportMatchParityImporter;

  /** Engine / row status after matching (import row or bulk preview). */
  status: string;
  proposed_company_id: string | null;
  proposed_company_name: string | null;
  match_method: ImportMatchMethod | null;
  match_confidence: "high" | null;
  conflict_type: ImportMatchConflictType | null;

  /** Sponsor / exhibitor live-link overlay. */
  intended_link_action: "create_new_link" | "update_tier" | "skip" | null;
  already_on_live_sponsor_id: string | null;
  already_on_live_exhibitor_id: string | null;
  already_on_live_tier_rank: number | null;

  /** Partner Alumni import version-member overlay. */
  intended_member_action: "create_new_link" | "skip" | "update_order" | null;
  already_on_version_member_id: string | null;

  /** True when matching leaves no proposed company (create-new path). */
  create_new_decision: boolean;

  /** Partner Alumni bulk preview status when applicable. */
  bulk_preview_status:
    | "matched"
    | "review"
    | "create_new"
    | "on_roster"
    | "duplicate_in_file"
    | "invalid"
    | null;

  /** Candidate company ids visible for this row's lookup keys (stable order). */
  candidate_company_ids: string[];
  /** Same ordering exposed explicitly for diffs. */
  candidate_ordering: string[];

  duplicate_in_file: boolean;
  on_roster: boolean;

  /**
   * Sponsor / exhibitor duplicate-in-file cluster fields
   * (written by assignDuplicateClusters; null when not in a multi-row cluster).
   */
  duplicate_cluster_key: string | null;
  duplicate_role: "canonical" | "duplicate" | null;
  duplicate_of_row_id: string | null;
  duplicate_resolution: "pending" | "kept" | "excluded" | null;

  /**
   * Persisted review-queue / import-row fields affected by matching.
   * Mirrors columns written by runBatchMatching (and bulk preview counterparts).
   */
  persisted: {
    status: string;
    match_method: ImportMatchMethod | null;
    match_confidence: "high" | null;
    proposed_company_id: string | null;
    conflict_type: ImportMatchConflictType | null;
    intended_link_action: "create_new_link" | "update_tier" | "skip" | null;
    intended_member_action: "create_new_link" | "skip" | "update_order" | null;
    already_on_live_sponsor_id: string | null;
    already_on_live_exhibitor_id: string | null;
    already_on_live_tier_rank: number | null;
    already_on_version_member_id: string | null;
    duplicate_cluster_key: string | null;
    duplicate_role: "canonical" | "duplicate" | null;
    duplicate_of_row_id: string | null;
    duplicate_resolution: "pending" | "kept" | "excluded" | null;
  };
};

export type ImportMatchParityRowInput = {
  normalized_domain: string | null;
  normalized_website: string | null;
  normalized_company_name: string | null;
  mapped_tier_rank?: number | null;
  mapped_display_order?: number | null;
  has_blocking_validation?: boolean;
};

/** Batch row used to lock assignDuplicateClusters persisted fields. */
export type ImportMatchParityClusterBatchRow = {
  id: string;
  excel_row_number: number;
  normalized_domain: string | null;
  normalized_website: string | null;
  normalized_company_name: string | null;
  mapped_tier_rank: number | null;
  has_blocking_validation?: boolean;
  status?: string;
};

export type ImportMatchParityClusterBatch = {
  subject_row_id: string;
  rows: readonly ImportMatchParityClusterBatchRow[];
};

export type ImportMatchParityLiveSponsor = {
  id: string;
  tier_rank: number | null;
};

export type ImportMatchParityLiveExhibitor = {
  id: string;
  tier_rank: number | null;
};

export type ImportMatchParityVersionMember = {
  id: string;
  display_order: number;
};
