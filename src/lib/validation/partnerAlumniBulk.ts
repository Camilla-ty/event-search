import type { PartnerAlumniBulkInputRow } from "@/src/features/partner-alumni/lib/parsePartnerAlumniBulkSpreadsheet";
import { PARTNER_ALUMNI_BULK_MAX_ROWS } from "@/src/features/partner-alumni/lib/parsePartnerAlumniBulkSpreadsheet";
import type { PartnerAlumniBulkCommitRow } from "@/src/features/partner-alumni/server/partnerAlumniBulkImport";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseBulkInputRow(raw: unknown): PartnerAlumniBulkInputRow | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const rowNumber =
    typeof record.row_number === "number" && Number.isInteger(record.row_number)
      ? record.row_number
      : null;
  const name = typeof record.name === "string" ? record.name : null;
  if (rowNumber === null || name === null) return null;

  const website =
    record.website === null || record.website === undefined
      ? null
      : typeof record.website === "string"
        ? record.website
        : null;

  const displayOrder =
    record.display_order === null || record.display_order === undefined
      ? null
      : typeof record.display_order === "number" && Number.isInteger(record.display_order)
        ? record.display_order
        : null;

  return {
    row_number: rowNumber,
    name,
    website,
    display_order: displayOrder,
  };
}

export function validatePartnerAlumniBulkPreviewBody(
  body: Record<string, unknown>,
):
  | { ok: true; rows: PartnerAlumniBulkInputRow[] }
  | { ok: false; errors: string[] } {
  if (!Array.isArray(body.rows)) {
    return { ok: false, errors: ["rows must be an array."] };
  }

  const rows: PartnerAlumniBulkInputRow[] = [];
  for (const item of body.rows) {
    const parsed = parseBulkInputRow(item);
    if (parsed) {
      rows.push(parsed);
    }
  }

  if (rows.length === 0) {
    return { ok: false, errors: ["At least one valid row is required."] };
  }

  if (rows.length > PARTNER_ALUMNI_BULK_MAX_ROWS) {
    return {
      ok: false,
      errors: [`Upload exceeds the ${PARTNER_ALUMNI_BULK_MAX_ROWS} row limit.`],
    };
  }

  return { ok: true, rows };
}

function parseCommitRow(raw: unknown): PartnerAlumniBulkCommitRow | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const rowNumber =
    typeof record.row_number === "number" && Number.isInteger(record.row_number)
      ? record.row_number
      : null;
  const name = typeof record.name === "string" ? record.name : null;
  const action = record.action === "skip" || record.action === "import" ? record.action : null;
  if (rowNumber === null || name === null || action === null) return null;

  const website =
    record.website === null || record.website === undefined
      ? null
      : typeof record.website === "string"
        ? record.website
        : null;

  const displayOrder =
    record.display_order === null || record.display_order === undefined
      ? null
      : typeof record.display_order === "number" && Number.isInteger(record.display_order)
        ? record.display_order
        : null;

  let companyId: string | null | undefined;
  if (record.company_id === null || record.company_id === undefined) {
    companyId = undefined;
  } else if (typeof record.company_id === "string" && UUID_REGEX.test(record.company_id.trim())) {
    companyId = record.company_id.trim();
  } else {
    return null;
  }

  const createNew = record.create_new === true;

  return {
    row_number: rowNumber,
    action,
    name,
    website,
    display_order: displayOrder,
    company_id: companyId,
    create_new: createNew ? true : undefined,
  };
}

export function validatePartnerAlumniBulkCommitBody(
  body: Record<string, unknown>,
):
  | { ok: true; rows: PartnerAlumniBulkCommitRow[] }
  | { ok: false; errors: string[] } {
  if (!Array.isArray(body.rows)) {
    return { ok: false, errors: ["rows must be an array."] };
  }

  const rows: PartnerAlumniBulkCommitRow[] = [];
  for (const item of body.rows) {
    const parsed = parseCommitRow(item);
    if (parsed) {
      rows.push(parsed);
    }
  }

  if (rows.length === 0) {
    return { ok: false, errors: ["At least one valid commit row is required."] };
  }

  if (rows.length > PARTNER_ALUMNI_BULK_MAX_ROWS) {
    return {
      ok: false,
      errors: [`Upload exceeds the ${PARTNER_ALUMNI_BULK_MAX_ROWS} row limit.`],
    };
  }

  return { ok: true, rows };
}
