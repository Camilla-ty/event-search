import type {
  ColumnMapping,
  ImportCompletionSummary,
  MaterializeCompaniesChunkResult,
  MaterializeVersionMembersChunkResult,
  MatchMethodSummary,
  MaterializePreviewSummary,
  PartnerAlumniImportBatchStatus,
  PartnerAlumniImportProcessingPhase,
  PartnerAlumniImportRowStatus,
  RowSummary,
  ValidationIssue,
} from "../types";

export type ImportStep =
  | "upload"
  | "mapping"
  | "validation"
  | "review"
  | "summary";

export type ImportScope = {
  seriesId: string;
  versionId: string;
};

export type PartnerAlumniImportBatch = {
  id: string;
  event_series_id: string;
  event_partner_alumni_version_id: string;
  status: PartnerAlumniImportBatchStatus;
  processing_phase: PartnerAlumniImportProcessingPhase | null;
  source_filename: string;
  source_file_storage_path: string;
  source_file_format: string;
  source_sheet_name: string | null;
  source_row_count: number;
  column_mapping: ColumnMapping;
  review_acknowledged_at: string | null;
  create_new_acknowledged_at: string | null;
  create_new_acknowledged_count: number | null;
  imported_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProposedImportCompany = {
  id: string;
  name: string;
  domain: string | null;
};

export type PartnerAlumniImportRow = {
  id: string;
  batch_id: string;
  excel_row_number: number;
  raw_company_name: string | null;
  raw_website: string | null;
  raw_display_order: string | null;
  normalized_company_name: string | null;
  normalized_website: string | null;
  normalized_domain: string | null;
  mapped_display_order: number | null;
  status: PartnerAlumniImportRowStatus;
  validation_issues: ValidationIssue[];
  has_blocking_validation: boolean;
  match_method: string | null;
  match_confidence: string | null;
  proposed_company_id: string | null;
  proposed_company?: ProposedImportCompany | null;
  conflict_type: string | null;
  decision_type: string | null;
  resolved_company_id: string | null;
  duplicate_cluster_key: string | null;
  duplicate_role: string | null;
  duplicate_of_row_id: string | null;
  duplicate_resolution: string | null;
  duplicate_cluster_size?: number | null;
  already_on_version_member_id: string | null;
  intended_member_action: string | null;
  version_member_id: string | null;
  import_error: string | null;
};

export type ApiOk<T> = { ok: true } & T;
export type ApiErr = { ok: false; error: string; details?: unknown };

export type {
  RowSummary,
  MatchMethodSummary,
  MaterializePreviewSummary,
  ImportCompletionSummary,
  MaterializeCompaniesChunkResult,
  MaterializeVersionMembersChunkResult,
  ColumnMapping,
};
