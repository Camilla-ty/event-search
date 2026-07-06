import * as XLSX from "xlsx";

import {
  canUsePositionalFallback,
  guessPartnerAlumniColumnMapping,
  isPartnerAlumniTitleRow,
  readPartnerAlumniBulkMatrix,
} from "@/src/features/partner-alumni/lib/parsePartnerAlumniBulkSpreadsheet";
import { columnIndexToLetter, columnMappingValue } from "@/src/features/sponsor-import/columnMappingUi";

import type { ColumnMapping, ParsedSpreadsheetRow, SourceFileFormat } from "../types";
import { PARTNER_ALUMNI_IMPORT_MAX_ROWS } from "../types";
import { PartnerAlumniImportHttpError } from "./errors";

export { columnMappingValue };

const HEADER_SCAN_LIMIT = 15;

export function detectSourceFormat(filename: string, mimeType: string): SourceFileFormat {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv") || mimeType.includes("csv")) return "csv";
  if (lower.endsWith(".xls")) return "xls";
  return "xlsx";
}

function findHeaderRowIndex(matrix: readonly string[][]): number | null {
  for (let index = 0; index < Math.min(matrix.length, HEADER_SCAN_LIMIT); index += 1) {
    const row = matrix[index] ?? [];
    if (row.every((cell) => cell.trim() === "") || isPartnerAlumniTitleRow(row)) {
      continue;
    }
    const guessed = guessPartnerAlumniColumnMapping(row);
    if (guessed?.website) {
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
    if ((headerRow[index] ?? "").trim().toLowerCase() === lower) {
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

function getSheetName(buffer: ArrayBuffer): string | null {
  try {
    const workbook = XLSX.read(buffer, { type: "array", raw: false });
    return workbook.SheetNames[0] ?? null;
  } catch {
    return null;
  }
}

function guessPositionalColumnMapping(matrix: readonly string[][]): ColumnMapping | null {
  if (!canUsePositionalFallback(matrix)) {
    return null;
  }

  const colCount = matrix.reduce((max, row) => Math.max(max, row.length), 0);
  if (colCount < 2) {
    return null;
  }

  return {
    company_name: columnIndexToLetter(0),
    website: columnIndexToLetter(1),
    ...(colCount >= 3 ? { display_order: columnIndexToLetter(2) } : {}),
    header_row_index: -1,
  };
}

function resolveHeaderContext(
  matrix: readonly string[][],
  mapping: ColumnMapping,
): { headerRowIndex: number; headerRow: string[]; dataStartIndex: number } {
  const isPositional = mapping.header_row_index === -1;
  if (isPositional) {
    return { headerRowIndex: -1, headerRow: [], dataStartIndex: 0 };
  }

  const headerRowIndex =
    typeof mapping.header_row_index === "number" && mapping.header_row_index >= 0
      ? mapping.header_row_index
      : (findHeaderRowIndex(matrix) ?? 0);

  return {
    headerRowIndex,
    headerRow: matrix[headerRowIndex] ?? [],
    dataStartIndex: headerRowIndex + 1,
  };
}

function enrichRowsWithNotes(
  matrix: readonly string[][],
  headerRowIndex: number,
  mapping: ColumnMapping,
  rows: ParsedSpreadsheetRow[],
): ParsedSpreadsheetRow[] {
  if (!mapping.notes?.trim()) {
    return rows;
  }

  const headerRow = headerRowIndex >= 0 ? (matrix[headerRowIndex] ?? []) : [];
  const notesIndex = resolveMappingColumnIndex(headerRow, mapping.notes);
  if (notesIndex === null) {
    return rows;
  }

  const dataStartIndex = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
  const notesByExcelRow = new Map<number, string | null>();
  for (let index = dataStartIndex; index < matrix.length; index += 1) {
    const row = matrix[index] ?? [];
    const cell = (row[notesIndex] ?? "").trim();
    notesByExcelRow.set(index + 1, cell === "" ? null : cell);
  }

  return rows.map((row) => ({
    ...row,
    rawNotes: notesByExcelRow.get(row.excelRowNumber) ?? row.rawNotes,
  }));
}

export function parseWithColumnMapping(
  buffer: ArrayBuffer,
  mapping: ColumnMapping,
): { rows: ParsedSpreadsheetRow[]; sheetName: string | null; headerRowIndex: number } {
  const matrix = readPartnerAlumniBulkMatrix(buffer);
  if (matrix.length === 0) {
    throw new PartnerAlumniImportHttpError(400, "No rows found in spreadsheet.");
  }

  const { headerRowIndex, headerRow, dataStartIndex } = resolveHeaderContext(matrix, mapping);

  const nameIndex = resolveMappingColumnIndex(headerRow, mapping.company_name);
  const websiteIndex = resolveMappingColumnIndex(headerRow, mapping.website);
  const orderIndex = mapping.display_order
    ? resolveMappingColumnIndex(headerRow, mapping.display_order)
    : null;

  if (nameIndex === null || websiteIndex === null) {
    throw new PartnerAlumniImportHttpError(
      400,
      "Column mapping references missing columns in the spreadsheet header.",
      { headerRowIndex, headerRow },
    );
  }

  const rows: ParsedSpreadsheetRow[] = [];
  for (let index = dataStartIndex; index < matrix.length; index += 1) {
    if (rows.length >= PARTNER_ALUMNI_IMPORT_MAX_ROWS) {
      throw new PartnerAlumniImportHttpError(
        400,
        `File has more than ${PARTNER_ALUMNI_IMPORT_MAX_ROWS} data rows.`,
      );
    }

    const row = matrix[index] ?? [];
    if (row.every((cell) => cell.trim() === "") || isPartnerAlumniTitleRow(row)) {
      continue;
    }

    const name = (row[nameIndex] ?? "").trim();
    const websiteRaw = (row[websiteIndex] ?? "").trim();
    const website = websiteRaw === "" ? null : websiteRaw;
    const orderRaw = orderIndex !== null ? (row[orderIndex] ?? "").trim() : "";

    if (name === "" && website === null && orderRaw === "") {
      continue;
    }

    rows.push({
      excelRowNumber: index + 1,
      rawCompanyName: name === "" ? null : name,
      rawWebsite: website,
      rawDisplayOrder: orderRaw === "" ? null : orderRaw,
      rawNotes: null,
    });
  }

  if (rows.length === 0) {
    throw new PartnerAlumniImportHttpError(400, "No data rows found in spreadsheet.");
  }

  return {
    rows: enrichRowsWithNotes(matrix, headerRowIndex, mapping, rows),
    sheetName: getSheetName(buffer),
    headerRowIndex,
  };
}

function buildProvisionalColumnMapping(buffer: ArrayBuffer): ColumnMapping {
  const matrix = readPartnerAlumniBulkMatrix(buffer);
  const positional = guessPositionalColumnMapping(matrix);
  if (positional) {
    return positional;
  }

  const preview = readSpreadsheetHeaders(buffer);
  const colCount = Math.max(preview.headers.length, 1);
  return {
    company_name: columnIndexToLetter(0),
    website: colCount >= 2 ? columnIndexToLetter(1) : columnIndexToLetter(0),
    ...(colCount >= 3 ? { display_order: columnIndexToLetter(2) } : {}),
    header_row_index: preview.headerRowIndex,
  };
}

/** Guess column mapping from header labels (prefill only — user must confirm). */
export function guessColumnMapping(buffer: ArrayBuffer): ColumnMapping | null {
  const matrix = readPartnerAlumniBulkMatrix(buffer);
  const positional = guessPositionalColumnMapping(matrix);
  const headerRowIndex = findHeaderRowIndex(matrix);
  if (headerRowIndex === null) {
    return positional;
  }

  const headerRow = matrix[headerRowIndex] ?? [];
  const guessed = guessPartnerAlumniColumnMapping(headerRow);
  if (!guessed?.website) {
    return positional;
  }

  return {
    company_name: guessed.name,
    website: guessed.website,
    ...(guessed.display_order ? { display_order: guessed.display_order } : {}),
    header_row_index: headerRowIndex,
  };
}

/** Upload-time mapping: infer when possible, otherwise return a provisional mapping for the UI. */
export function resolveUploadColumnMapping(buffer: ArrayBuffer): ColumnMapping {
  return guessColumnMapping(buffer) ?? buildProvisionalColumnMapping(buffer);
}

export function readSpreadsheetHeaders(
  buffer: ArrayBuffer,
  headerRowIndex?: number,
): { headers: string[]; headerRowIndex: number; previewRows: string[][] } {
  const matrix = readPartnerAlumniBulkMatrix(buffer);
  if (matrix.length === 0) {
    return { headers: [], headerRowIndex: 0, previewRows: [] };
  }

  if (headerRowIndex === -1 || (headerRowIndex === undefined && canUsePositionalFallback(matrix))) {
    const colCount = matrix.reduce((max, row) => Math.max(max, row.length), 0);
    return {
      headers: Array.from({ length: Math.max(colCount, 1) }, () => ""),
      headerRowIndex: -1,
      previewRows: matrix.slice(0, 6),
    };
  }

  const resolvedIndex =
    typeof headerRowIndex === "number" && headerRowIndex >= 0
      ? headerRowIndex
      : (findHeaderRowIndex(matrix) ?? 0);

  const headers = (matrix[resolvedIndex] ?? []).map((cell) => cell.trim());
  const previewRows = matrix.slice(resolvedIndex, resolvedIndex + 6);

  return { headers, headerRowIndex: resolvedIndex, previewRows };
}

export function toColumnMapping(raw: unknown): ColumnMapping {
  if (!raw || typeof raw !== "object") {
    throw new PartnerAlumniImportHttpError(400, "column_mapping must be an object.");
  }

  const o = raw as Record<string, unknown>;
  const company_name = typeof o.company_name === "string" ? o.company_name.trim() : "";
  const website = typeof o.website === "string" ? o.website.trim() : "";
  if (!company_name || !website) {
    throw new PartnerAlumniImportHttpError(
      400,
      "column_mapping requires company_name and website.",
    );
  }

  const display_order =
    typeof o.display_order === "string" ? o.display_order.trim() : undefined;
  const notes = typeof o.notes === "string" ? o.notes.trim() : undefined;
  const header_row_index =
    typeof o.header_row_index === "number" && Number.isInteger(o.header_row_index)
      ? o.header_row_index
      : undefined;

  return {
    company_name,
    website,
    ...(display_order ? { display_order } : {}),
    ...(notes ? { notes } : {}),
    ...(header_row_index !== undefined ? { header_row_index } : {}),
  };
}

export { buildSpreadsheetColumnOptions, columnIndexToLetter } from "@/src/features/sponsor-import/columnMappingUi";
