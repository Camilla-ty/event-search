import type { ColumnMapping } from "../types";
import type { RowSummary, SponsorImportBatch } from "../client/types";

function parseColumnMapping(raw: unknown): ColumnMapping {
  if (!raw || typeof raw !== "object") {
    return { company_name: "A", website: "B", tier_rank: "C", tier_label: "D" };
  }
  const o = raw as Record<string, unknown>;
  return {
    company_name: typeof o.company_name === "string" ? o.company_name : "A",
    website: typeof o.website === "string" ? o.website : "B",
    tier_rank: typeof o.tier_rank === "string" ? o.tier_rank : "C",
    tier_label: typeof o.tier_label === "string" ? o.tier_label : "D",
    notes: typeof o.notes === "string" ? o.notes : undefined,
  };
}

export function mapBatchForClient(raw: Record<string, unknown>): SponsorImportBatch {
  return {
    id: String(raw.id),
    event_edition_id: String(raw.event_edition_id),
    status: raw.status as SponsorImportBatch["status"],
    processing_phase:
      raw.processing_phase === null || typeof raw.processing_phase === "string"
        ? (raw.processing_phase as SponsorImportBatch["processing_phase"])
        : null,
    source_filename: String(raw.source_filename),
    source_file_storage_path: String(raw.source_file_storage_path),
    source_file_format: String(raw.source_file_format),
    source_sheet_name:
      raw.source_sheet_name === null || typeof raw.source_sheet_name === "string"
        ? raw.source_sheet_name
        : null,
    source_row_count: Number(raw.source_row_count),
    column_mapping: parseColumnMapping(raw.column_mapping),
    created_at: String(raw.created_at),
    updated_at: String(raw.updated_at),
    published_at:
      raw.published_at === null || typeof raw.published_at === "string"
        ? raw.published_at
        : undefined,
  };
}

export function mapSummaryForClient(raw: RowSummary): RowSummary {
  return {
    total: Number(raw.total),
    needs_review: Number(raw.needs_review),
    auto_ready: Number(raw.auto_ready),
    resolved: Number(raw.resolved),
    excluded: Number(raw.excluded),
    blocking_validation_count: Number(raw.blocking_validation_count),
    pending_duplicate_count: Number(raw.pending_duplicate_count),
  };
}
