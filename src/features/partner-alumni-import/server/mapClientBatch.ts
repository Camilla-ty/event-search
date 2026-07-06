import type { ColumnMapping } from "../types";
import type { PartnerAlumniImportBatch } from "../client/types";

function parseColumnMapping(raw: unknown): ColumnMapping {
  if (!raw || typeof raw !== "object") {
    return { company_name: "A", website: "B" };
  }
  const o = raw as Record<string, unknown>;
  return {
    company_name: typeof o.company_name === "string" ? o.company_name : "A",
    website: typeof o.website === "string" ? o.website : "B",
    display_order: typeof o.display_order === "string" ? o.display_order : undefined,
    notes: typeof o.notes === "string" ? o.notes : undefined,
    header_row_index:
      typeof o.header_row_index === "number" ? o.header_row_index : undefined,
  };
}

export function mapBatchForClient(raw: Record<string, unknown>): PartnerAlumniImportBatch {
  return {
    id: String(raw.id),
    event_series_id: String(raw.event_series_id),
    event_partner_alumni_version_id: String(raw.event_partner_alumni_version_id),
    status: raw.status as PartnerAlumniImportBatch["status"],
    processing_phase:
      raw.processing_phase === null || typeof raw.processing_phase === "string"
        ? (raw.processing_phase as PartnerAlumniImportBatch["processing_phase"])
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
    review_acknowledged_at:
      raw.review_acknowledged_at === null || typeof raw.review_acknowledged_at === "string"
        ? raw.review_acknowledged_at
        : null,
    create_new_acknowledged_at:
      raw.create_new_acknowledged_at === null ||
      typeof raw.create_new_acknowledged_at === "string"
        ? raw.create_new_acknowledged_at
        : null,
    create_new_acknowledged_count:
      typeof raw.create_new_acknowledged_count === "number"
        ? raw.create_new_acknowledged_count
        : null,
    imported_at:
      raw.imported_at === null || typeof raw.imported_at === "string" ? raw.imported_at : null,
    created_at: String(raw.created_at),
    updated_at: String(raw.updated_at),
  };
}
