export const PARTNER_ALUMNI_IMPORT_MAX_ROWS = 500;

export const PARTNER_ALUMNI_IMPORT_BUCKET = "partner-alumni-imports";

export type PartnerAlumniImportBatchStatus =
  | "uploaded"
  | "review"
  | "imported"
  | "discarded";

export type PartnerAlumniImportProcessingPhase =
  | "parsing"
  | "validating"
  | "matching"
  | "materializing_companies"
  | "materializing_members";

export type PartnerAlumniImportRowStatus =
  | "needs_review"
  | "auto_ready"
  | "resolved"
  | "excluded";

export type PartnerAlumniImportMatchMethod =
  | "domain"
  | "alias"
  | "website"
  | "exact_name"
  | "manual"
  | "create_new";

export type PartnerAlumniImportDecisionType =
  | "use_matched"
  | "create_new"
  | "choose_different"
  | "exclude";

export type PartnerAlumniImportActionType =
  | "upload"
  | "column_mapping_saved"
  | "validation_run"
  | "matching_run"
  | "bulk_accept_domain_matches"
  | "review_acknowledged"
  | "create_new_acknowledged"
  | "materialize_companies_chunk"
  | "materialize_members_chunk"
  | "import_completed"
  | "discard";

export type ColumnMapping = {
  company_name: string;
  website: string;
  display_order?: string;
  notes?: string;
  /** Zero-based header row index when the sheet has leading title rows. */
  header_row_index?: number;
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
  rawDisplayOrder: string | null;
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

export type MatchMethodSummary = {
  domain: number;
  alias: number;
  website: number;
  exact_name: number;
  manual: number;
  create_new: number;
};

export type MaterializePreviewSummary = {
  companies_to_create: number;
  members_to_create: number;
  members_to_update: number;
  members_to_skip: number;
};

export type SourceFileFormat = "xlsx" | "xls" | "csv";

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

export type MaterializeVersionMembersChunkResult = {
  examined_count: number;
  skipped_count: number;
  members_created: number;
  members_updated: number;
  rows_linked: number;
  total_resolved_rows: number;
  rows_with_version_member: number;
  done: boolean;
  next_cursor: number | null;
};

export type ImportCompletionSummary = {
  companies_created: number;
  members_created: number;
  members_updated: number;
  rows_imported: number;
  rows_excluded: number;
  rows_skipped: number;
};
