import type {
  ImportMatchConflictType,
  ImportMatchMethod,
} from "@/src/lib/companies/companyImportMatching";
import type { ImportMatchParityImporter } from "@/src/lib/companies/importMatchParity/types";

/**
 * Persisted matching decision fields compared in ARC-003 Phase 2 shadow runs.
 * Mirrors columns written by runBatchMatching / PA bulk preview (read-only compare).
 */
export type ImportMatchShadowPersistedDecision = {
  row_id: string;
  importer: ImportMatchParityImporter;
  status: string;
  match_method: ImportMatchMethod | null;
  match_confidence: "high" | null;
  proposed_company_id: string | null;
  conflict_type: ImportMatchConflictType | null;
  intended_link_action: "create_new_link" | "update_tier" | "skip" | null;
  already_on_live_sponsor_id: string | null;
  already_on_live_exhibitor_id: string | null;
  already_on_live_tier_rank: number | null;
  intended_member_action: "create_new_link" | "skip" | "update_order" | null;
  already_on_version_member_id: string | null;
  bulk_preview_status:
    | "matched"
    | "review"
    | "create_new"
    | "on_roster"
    | "duplicate_in_file"
    | "invalid"
    | null;
};

export type ImportMatchShadowRowInput = {
  id: string;
  normalized_domain: string | null;
  normalized_website: string | null;
  normalized_company_name: string | null;
  mapped_tier_rank?: number | null;
  mapped_display_order?: number | null;
  has_blocking_validation?: boolean;
  /** Partner Alumni bulk only. */
  on_roster?: boolean;
  duplicate_in_file?: boolean;
  duplicate_in_file_kind?: "identity_key" | "company_id";
};

export type ImportMatchShadowBatchSummary = {
  importer: ImportMatchParityImporter;
  batch_id: string | null;
  row_count: number;
  compared: number;
  matched: number;
};
