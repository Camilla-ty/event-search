export const SPONSOR_IMPORT_MAX_ROWS = 500;

export const SPONSOR_IMPORT_BUCKET = "sponsor-imports";

export type SponsorImportBatchStatus =
  | "uploaded"
  | "review"
  | "draft"
  | "published"
  | "discarded";

export type SponsorImportProcessingPhase =
  | "parsing"
  | "validating"
  | "matching"
  | "materializing_companies"
  | "importing_to_draft"
  | "publishing";

export type SponsorImportRowStatus =
  | "needs_review"
  | "auto_ready"
  | "resolved"
  | "excluded";

export type SponsorImportDecisionType =
  | "use_matched"
  | "create_new"
  | "choose_different"
  | "exclude";

export type SponsorImportActionType =
  | "upload"
  | "column_mapping_saved"
  | "validation_run"
  | "matching_run"
  | "bulk_accept_domain_matches"
  | "materialize_companies_chunk"
  | "import_to_draft"
  | "review_acknowledged"
  | "publish"
  | "discard";

export type ColumnMapping = {
  company_name: string;
  website: string;
  tier_rank: string;
  tier_label: string;
  notes?: string;
};

export type ValidationIssue = {
  type: string;
  severity: "blocking" | "warning";
  message: string;
  resolved?: boolean;
};

export type ParsedSpreadsheetRow = {
  excelRowNumber: number;
  rawCompanyName: string | null;
  rawWebsite: string | null;
  rawTierRank: number | null;
  rawTierLabel: string | null;
  rawNotes: string | null;
};

export type RowSummary = {
  total: number;
  needs_review: number;
  auto_ready: number;
  resolved: number;
  excluded: number;
  blocking_validation_count: number;
  pending_duplicate_count: number;
};

export type DraftDiffSummary = {
  new: number;
  tier_updated: number;
  unchanged: number;
  excluded: number;
};

export type PublishResult = {
  new_count: number;
  tier_updated_count: number;
  unchanged_count: number;
  excluded_count: number;
};

export type ImportToDraftResult = {
  companies_created: number;
  draft_links_created: number;
  draft_links_updated: number;
  rows_materialized: number;
};

export type MaterializeCompaniesChunkResult = {
  examined_count: number;
  skipped_count: number;
  materialized_count: number;
  companies_created: number;
  total_resolved_rows: number;
  rows_with_company_id: number;
  done: boolean;
  next_cursor: number | null;
};
