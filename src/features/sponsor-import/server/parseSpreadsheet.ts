import * as XLSX from "xlsx";

import {
  buildSpreadsheetColumnOptions,
  columnIndexToLetter,
  columnMappingValue,
} from "../columnMappingUi";
import type { ColumnMapping, ParsedSpreadsheetRow } from "../types";
import { SPONSOR_IMPORT_MAX_ROWS } from "../types";

export { buildSpreadsheetColumnOptions, columnIndexToLetter, columnMappingValue };
export type { SpreadsheetColumnOption } from "../columnMappingUi";

export type SourceFileFormat = "xlsx" | "xls" | "csv";

export function detectSourceFormat(filename: string, mimeType: string): SourceFileFormat {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv") || mimeType.includes("csv")) return "csv";
  if (lower.endsWith(".xls")) return "xls";
  return "xlsx";
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
  if (value instanceof Date) {
    return value.toISOString();
  }
  const text = String(value).trim();
  return text === "" ? null : text;
}

function cellToTier(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isInteger(n)) return null;
  return n;
}

function resolveColumnIndex(headerRow: string[], name: string): number | null {
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  const headerIndex = new Map<string, number>();
  headerRow.forEach((h, idx) => {
    const key = (h ?? "").trim().toLowerCase();
    if (key) headerIndex.set(key, idx);
  });

  if (headerIndex.has(lower)) return headerIndex.get(lower) ?? null;

  if (/^[A-Za-z]+$/.test(trimmed) && trimmed.length <= 3) {
    let idx = 0;
    for (const ch of trimmed.toUpperCase()) {
      idx = idx * 26 + (ch.charCodeAt(0) - 64);
    }
    return idx - 1;
  }

  const asNum = Number(trimmed);
  if (Number.isInteger(asNum) && asNum >= 0) return asNum;

  return null;
}

export function parseWithColumnMapping(
  buffer: ArrayBuffer,
  mapping: ColumnMapping,
): { rows: ParsedSpreadsheetRow[]; sheetName: string | null } {
  const workbook = XLSX.read(buffer, { type: "array", raw: false, cellDates: true });
  const sheetName = workbook.SheetNames[0] ?? null;
  if (!sheetName) return { rows: [], sheetName: null };

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: false,
  });
  if (matrix.length <= 1) return { rows: [], sheetName };

  const headerRow = (matrix[0] ?? []).map((c) => cellToString(c) ?? "");
  const dataMatrix = matrix.slice(1);

  const nameIdx = resolveColumnIndex(headerRow, mapping.company_name);
  const webIdx = resolveColumnIndex(headerRow, mapping.website);
  const tierIdx = resolveColumnIndex(headerRow, mapping.tier_rank);
  const labelIdx = resolveColumnIndex(headerRow, mapping.tier_label);
  const notesIdx = mapping.notes ? resolveColumnIndex(headerRow, mapping.notes) : null;

  if (nameIdx === null || webIdx === null || tierIdx === null || labelIdx === null) {
    throw new Error("Column mapping references missing columns in the spreadsheet header.");
  }

  if (dataMatrix.length > SPONSOR_IMPORT_MAX_ROWS) {
    throw new Error(
      `File has ${dataMatrix.length} data rows; maximum is ${SPONSOR_IMPORT_MAX_ROWS}.`,
    );
  }

  const rows: ParsedSpreadsheetRow[] = [];
  for (let i = 0; i < dataMatrix.length; i++) {
    const row = dataMatrix[i] ?? [];
    const hasAny =
      cellToString(row[nameIdx]) !== null ||
      cellToString(row[webIdx]) !== null ||
      cellToTier(row[tierIdx]) !== null ||
      cellToString(row[labelIdx]) !== null;
    if (!hasAny) continue;

    rows.push({
      excelRowNumber: i + 2,
      rawCompanyName: cellToString(row[nameIdx]),
      rawWebsite: cellToString(row[webIdx]),
      rawTierRank: cellToTier(row[tierIdx]),
      rawTierLabel: cellToString(row[labelIdx]),
      rawNotes: notesIdx !== null ? cellToString(row[notesIdx]) : null,
    });
  }

  return { rows, sheetName };
}

function findColumnIndex(
  headerRow: string[],
  patterns: RegExp[],
  used: Set<number>,
): number | null {
  for (let i = 0; i < headerRow.length; i++) {
    if (used.has(i)) continue;
    const label = (headerRow[i] ?? "").trim();
    if (!label) continue;
    if (patterns.some((p) => p.test(label))) {
      return i;
    }
  }
  return null;
}

/** Guess column mapping from header labels (fallback when client omits mapping). */
export function guessColumnMapping(headerRow: string[]): ColumnMapping | null {
  const used = new Set<number>();

  const tierRankIdx = findColumnIndex(
    headerRow,
    [/sponsor\s*tier/i, /^tier\s*rank$/i, /^rank$/i, /^tier$/i],
    used,
  );
  if (tierRankIdx !== null) used.add(tierRankIdx);

  const tierLabelIdx = findColumnIndex(
    headerRow,
    [/sponsor\s*label/i, /tier\s*label/i, /^label$/i],
    used,
  );
  if (tierLabelIdx !== null) used.add(tierLabelIdx);

  const companyIdx = findColumnIndex(
    headerRow,
    [/^name$/i, /company\s*name/i, /organization/i, /company/i],
    used,
  );
  if (companyIdx !== null) used.add(companyIdx);

  const websiteIdx = findColumnIndex(
    headerRow,
    [/website/i, /url/i, /domain/i, /web/i],
    used,
  );

  if (
    tierRankIdx === null ||
    tierLabelIdx === null ||
    companyIdx === null ||
    websiteIdx === null
  ) {
    return null;
  }

  return {
    company_name: columnMappingValue(headerRow, companyIdx),
    website: columnMappingValue(headerRow, websiteIdx),
    tier_rank: columnMappingValue(headerRow, tierRankIdx),
    tier_label: columnMappingValue(headerRow, tierLabelIdx),
  };
}

export function readSpreadsheetHeaders(buffer: ArrayBuffer): string[] {
  const workbook = XLSX.read(buffer, { type: "array", raw: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
  });
  const header = matrix[0] ?? [];
  return header.map((c) => cellToString(c) ?? "");
}
