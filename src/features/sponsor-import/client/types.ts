import type {
  ColumnMapping,
  DraftDiffSummary,
  PublishResult,
  RowSummary,
  SponsorImportBatchStatus,
  SponsorImportProcessingPhase,
  SponsorImportRowStatus,
  ValidationIssue,
} from "../types";

export type ImportStep =
  | "upload"
  | "mapping"
  | "validation"
  | "review"
  | "draft"
  | "publish";

export type SponsorImportBatch = {
  id: string;
  event_edition_id: string;
  status: SponsorImportBatchStatus;
  processing_phase: SponsorImportProcessingPhase | null;
  source_filename: string;
  source_file_storage_path: string;
  source_file_format: string;
  source_sheet_name: string | null;
  source_row_count: number;
  column_mapping: ColumnMapping;
  created_at: string;
  updated_at: string;
  published_at?: string | null;
};

export type ProposedImportCompany = {
  id: string;
  name: string;
  domain: string | null;
};

export type SponsorImportRow = {
  id: string;
  batch_id: string;
  excel_row_number: number;
  raw_company_name: string | null;
  raw_website: string | null;
  raw_tier_rank: number | null;
  raw_tier_label: string | null;
  normalized_company_name: string | null;
  normalized_website: string | null;
  normalized_domain: string | null;
  mapped_tier_rank: number | null;
  mapped_tier_label: string | null;
  status: SponsorImportRowStatus;
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
  already_on_live_sponsor_id: string | null;
  already_on_live_tier_rank: number | null;
  intended_link_action: string | null;
};

export type DraftLinkRow = {
  id: string;
  company_id: string;
  tier_rank: number;
  tier_label: string | null;
  excluded_from_publish: boolean;
  companies?: {
    id: string;
    name: string;
    slug: string;
    domain: string | null;
  } | null;
};

export type ApiOk<T> = { ok: true } & T;
export type ApiErr = { ok: false; error: string; details?: unknown };

export type BatchListItem = SponsorImportBatch & {
  edition_name?: string;
  edition_year?: number;
  series_name?: string | null;
};

export type { RowSummary, DraftDiffSummary, PublishResult };
