import * as XLSX from "xlsx";

import {
  buildSpreadsheetColumnOptions,
  columnIndexToLetter,
  columnMappingValue,
} from "@/src/features/sponsor-import/columnMappingUi";

export type PartnerAlumniBulkInputRow = {
  row_number: number;
  name: string;
  website: string | null;
  display_order: number | null;
};

export type PartnerAlumniBulkColumnMapping = {
  /** Header label or column letter (e.g. "Company Name", "B"). */
  name: string;
  website?: string | null;
  display_order?: string | null;
  /** Zero-based header row index when the sheet has leading title rows. */
  header_row_index?: number;
};

export type PartnerAlumniBulkParseResult =
  | {
      ok: true;
      rows: PartnerAlumniBulkInputRow[];
      headerRowIndex: number;
      dataRowCount: number;
    }
  | {
      ok: false;
      code: "needs_column_mapping";
      message: string;
      headerRowIndex: number;
      headerRow: string[];
      sampleRows: string[][];
    }
  | {
      ok: false;
      code: "empty" | "too_many_rows";
      message: string;
    };

export const PARTNER_ALUMNI_BULK_MAX_ROWS = 500;

const HEADER_SCAN_LIMIT = 15;

const NAME_HEADERS = new Set([
  "name",
  "company",
  "company name",
  "company_name",
  "companyname",
  "organization",
  "organisation",
  "sponsor",
  "partner",
]);

const WEBSITE_HEADERS = new Set([
  "website",
  "domain",
  "url",
  "website/domain",
  "website / domain",
  "website or domain",
  "web",
  "website domain",
]);

const ORDER_HEADERS = new Set(["display_order", "order", "display order", "#", "rank"]);

const TITLE_ROW_PATTERNS = [
  /^partner\s*alumni$/i,
  /^our\s+partners?(?:\s+over\s+the\s+years)?$/i,
  /^past\s+sponsors?$/i,
  /^long[\s-]*term\s+partners?$/i,
  /^partner\s+recognition$/i,
] as const;

function isPrintableRowName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed === "") return false;
  return !/[\u0000-\u0008\u000e-\u001f]/.test(trimmed);
}

function cellToString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  const text = String(value).trim();
  return text === "" ? null : text;
}

function cellToOrder(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

function normalizeHeaderKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function resolveColumnIndex(headerRow: readonly string[], aliases: ReadonlySet<string>): number | null {
  for (let index = 0; index < headerRow.length; index += 1) {
    const key = normalizeHeaderKey(headerRow[index] ?? "");
    if (key !== "" && aliases.has(key)) {
      return index;
    }
  }
  return null;
}

function resolveMappingColumnIndex(headerRow: readonly string[], mappingValue: string): number | null {
  const trimmed = mappingValue.trim();
  if (trimmed === "") return null;

  const lower = trimmed.toLowerCase();
  for (let index = 0; index < headerRow.length; index += 1) {
    if (normalizeHeaderKey(headerRow[index] ?? "") === lower) {
      return index;
    }
  }

  if (/^[A-Za-z]+$/.test(trimmed) && trimmed.length <= 3) {
    let index = 0;
    for (const char of trimmed.toUpperCase()) {
      index = index * 26 + (char.charCodeAt(0) - 64);
    }
    return index - 1;
  }

  const asNumber = Number(trimmed);
  if (Number.isInteger(asNumber) && asNumber >= 0) {
    return asNumber;
  }

  return null;
}

function rowHasAnyValue(row: readonly string[]): boolean {
  return row.some((cell) => cell.trim() !== "");
}

/** Section title rows such as "Partner Alumni" must not become company data. */
export function isPartnerAlumniTitleRow(row: readonly string[]): boolean {
  const nonEmpty = row.map((cell) => cell.trim()).filter((cell) => cell !== "");
  if (nonEmpty.length === 0) return false;

  const firstCell = (row[0] ?? "").trim();
  const firstLooksLikeTitle = TITLE_ROW_PATTERNS.some((pattern) => pattern.test(firstCell));
  if (!firstLooksLikeTitle) return false;

  const hasHeaderLabels =
    resolveColumnIndex(row, NAME_HEADERS) !== null ||
    resolveColumnIndex(row, WEBSITE_HEADERS) !== null ||
    resolveColumnIndex(row, ORDER_HEADERS) !== null;

  return !hasHeaderLabels;
}

function findHeaderRowIndex(matrix: readonly string[][]): number | null {
  for (let index = 0; index < Math.min(matrix.length, HEADER_SCAN_LIMIT); index += 1) {
    const row = matrix[index] ?? [];
    if (!rowHasAnyValue(row) || isPartnerAlumniTitleRow(row)) {
      continue;
    }

    const nameIndex = resolveColumnIndex(row, NAME_HEADERS);
    const websiteIndex = resolveColumnIndex(row, WEBSITE_HEADERS);
    if (nameIndex !== null && websiteIndex !== null) {
      return index;
    }
  }

  return null;
}

export function canUsePositionalFallback(matrix: readonly string[][]): boolean {
  if (matrix.length === 0) return false;
  if (matrix.some((row) => isPartnerAlumniTitleRow(row))) {
    return false;
  }
  if (findHeaderRowIndex(matrix) !== null) {
    return false;
  }

  const firstRow = matrix[0] ?? [];
  const firstName = (firstRow[0] ?? "").trim();
  if (firstName === "") return false;

  return !TITLE_ROW_PATTERNS.some((pattern) => pattern.test(firstName));
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  result.push(current.trim());
  return result;
}

function parsePlainCsvText(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map(parseCsvLine)
    .filter((row) => row.some((cell) => cell.trim() !== ""));
}

function isLikelySpreadsheetBinary(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer.slice(0, 4));
  if (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b) return true;
  if (bytes.length >= 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf) return true;
  return false;
}

export function readPartnerAlumniBulkMatrix(buffer: ArrayBuffer): string[][] {
  if (!isLikelySpreadsheetBinary(buffer)) {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    if (text.includes(",") || text.includes("\t")) {
      return parsePlainCsvText(text);
    }
  }

  const workbook = XLSX.read(buffer, { type: "array", raw: false, cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: false,
  });

  return matrix.map((row) =>
    row.map((cell) => {
      const text = cellToString(cell);
      return text ?? "";
    }),
  );
}

function buildRowsFromMatrix(
  matrix: readonly string[][],
  headerRowIndex: number,
  nameIndex: number,
  websiteIndex: number | null,
  orderIndex: number | null,
): PartnerAlumniBulkInputRow[] {
  const rows: PartnerAlumniBulkInputRow[] = [];

  for (let index = headerRowIndex + 1; index < matrix.length; index += 1) {
    if (rows.length >= PARTNER_ALUMNI_BULK_MAX_ROWS) break;

    const row = matrix[index] ?? [];
    if (!rowHasAnyValue(row) || isPartnerAlumniTitleRow(row)) {
      continue;
    }

    const excelRowNumber = index + 1;
    const name = (row[nameIndex] ?? "").trim();
    const websiteRaw = websiteIndex !== null ? row[websiteIndex] ?? "" : "";
    const website = cellToString(websiteRaw);
    const displayOrder =
      orderIndex !== null ? cellToOrder(row[orderIndex]) : null;

    if (name === "" && website === null && displayOrder === null) {
      continue;
    }
    if (name !== "" && !isPrintableRowName(name)) {
      continue;
    }

    rows.push({
      row_number: excelRowNumber,
      name,
      website,
      display_order: displayOrder,
    });
  }

  return rows;
}

function buildPositionalRows(matrix: readonly string[][]): PartnerAlumniBulkInputRow[] {
  const rows: PartnerAlumniBulkInputRow[] = [];

  for (let index = 0; index < matrix.length; index += 1) {
    if (rows.length >= PARTNER_ALUMNI_BULK_MAX_ROWS) break;

    const row = matrix[index] ?? [];
    if (!rowHasAnyValue(row)) continue;

    const name = (row[0] ?? "").trim();
    const website = cellToString(row[1] ?? "");
    const displayOrder = cellToOrder(row[2]);

    if (name === "" && website === null && displayOrder === null) {
      continue;
    }
    if (name !== "" && !isPrintableRowName(name)) {
      continue;
    }

    rows.push({
      row_number: index + 1,
      name,
      website,
      display_order: displayOrder,
    });
  }

  return rows;
}

function buildMappingNeededResult(
  matrix: readonly string[][],
  headerRowIndex: number,
): Extract<PartnerAlumniBulkParseResult, { ok: false; code: "needs_column_mapping" }> {
  const headerRow = matrix[headerRowIndex] ?? [];
  const sampleRows = matrix.slice(headerRowIndex, headerRowIndex + 6);

  return {
    ok: false,
    code: "needs_column_mapping",
    message:
      "Could not detect company name and website columns. Choose which row contains headers and map columns before preview.",
    headerRowIndex,
    headerRow,
    sampleRows,
  };
}

export function guessPartnerAlumniColumnMapping(
  headerRow: readonly string[],
): PartnerAlumniBulkColumnMapping | null {
  const nameIndex = resolveColumnIndex(headerRow, NAME_HEADERS);
  if (nameIndex === null) return null;

  const websiteIndex = resolveColumnIndex(headerRow, WEBSITE_HEADERS);
  const orderIndex = resolveColumnIndex(headerRow, ORDER_HEADERS);

  return {
    name: columnMappingValue([...headerRow], nameIndex),
    website:
      websiteIndex !== null ? columnMappingValue([...headerRow], websiteIndex) : null,
    display_order:
      orderIndex !== null ? columnMappingValue([...headerRow], orderIndex) : null,
  };
}

export { buildSpreadsheetColumnOptions, columnIndexToLetter, columnMappingValue };

/** Parse first worksheet from CSV/XLS/XLSX into Partner Alumni bulk rows. */
export function parsePartnerAlumniBulkSpreadsheet(
  buffer: ArrayBuffer,
  mapping?: PartnerAlumniBulkColumnMapping,
): PartnerAlumniBulkParseResult {
  const matrix = readPartnerAlumniBulkMatrix(buffer);
  if (matrix.length === 0) {
    return { ok: false, code: "empty", message: "No rows found in spreadsheet." };
  }

  if (mapping) {
    const headerRowIndex =
      typeof mapping.header_row_index === "number" && mapping.header_row_index >= 0
        ? mapping.header_row_index
        : findHeaderRowIndex(matrix) ?? 0;
    const headerRow = matrix[headerRowIndex] ?? [];
    const nameIndex = resolveMappingColumnIndex(headerRow, mapping.name);
    const websiteIndex =
      mapping.website && mapping.website.trim() !== ""
        ? resolveMappingColumnIndex(headerRow, mapping.website)
        : null;
    const orderIndex =
      mapping.display_order && mapping.display_order.trim() !== ""
        ? resolveMappingColumnIndex(headerRow, mapping.display_order)
        : null;

    if (nameIndex === null) {
      return buildMappingNeededResult(matrix, headerRowIndex);
    }

    const rows = buildRowsFromMatrix(matrix, headerRowIndex, nameIndex, websiteIndex, orderIndex);
    if (rows.length === 0) {
      return { ok: false, code: "empty", message: "No company rows found after column mapping." };
    }
    if (rows.length > PARTNER_ALUMNI_BULK_MAX_ROWS) {
      return {
        ok: false,
        code: "too_many_rows",
        message: `Upload exceeds the ${PARTNER_ALUMNI_BULK_MAX_ROWS} row limit.`,
      };
    }

    return {
      ok: true,
      rows,
      headerRowIndex,
      dataRowCount: rows.length,
    };
  }

  const headerRowIndex = findHeaderRowIndex(matrix);
  if (headerRowIndex !== null) {
    const headerRow = matrix[headerRowIndex] ?? [];
    const nameIndex = resolveColumnIndex(headerRow, NAME_HEADERS);
    const websiteIndex = resolveColumnIndex(headerRow, WEBSITE_HEADERS);
    const orderIndex = resolveColumnIndex(headerRow, ORDER_HEADERS);

    if (nameIndex === null) {
      return buildMappingNeededResult(matrix, headerRowIndex);
    }

    const rows = buildRowsFromMatrix(matrix, headerRowIndex, nameIndex, websiteIndex, orderIndex);
    if (rows.length === 0) {
      return { ok: false, code: "empty", message: "No company rows found below the header row." };
    }
    if (rows.length > PARTNER_ALUMNI_BULK_MAX_ROWS) {
      return {
        ok: false,
        code: "too_many_rows",
        message: `Upload exceeds the ${PARTNER_ALUMNI_BULK_MAX_ROWS} row limit.`,
      };
    }

    return {
      ok: true,
      rows,
      headerRowIndex,
      dataRowCount: rows.length,
    };
  }

  if (canUsePositionalFallback(matrix)) {
    const rows = buildPositionalRows(matrix);
    if (rows.length === 0) {
      return { ok: false, code: "empty", message: "No company rows found in spreadsheet." };
    }
    if (rows.length > PARTNER_ALUMNI_BULK_MAX_ROWS) {
      return {
        ok: false,
        code: "too_many_rows",
        message: `Upload exceeds the ${PARTNER_ALUMNI_BULK_MAX_ROWS} row limit.`,
      };
    }

    return {
      ok: true,
      rows,
      headerRowIndex: -1,
      dataRowCount: rows.length,
    };
  }

  const fallbackHeaderIndex = matrix.findIndex((row) => rowHasAnyValue(row));
  return buildMappingNeededResult(matrix, fallbackHeaderIndex >= 0 ? fallbackHeaderIndex : 0);
}
