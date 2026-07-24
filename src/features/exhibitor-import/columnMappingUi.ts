export function columnIndexToLetter(index: number): string {
  let result = "";
  let n = index;
  while (n >= 0) {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

/** Mapping value stored in column_mapping: header label when present, else column letter. */
export function columnMappingValue(headerRow: string[], index: number): string {
  const label = (headerRow[index] ?? "").trim();
  return label !== "" ? label : columnIndexToLetter(index);
}

export type SpreadsheetColumnOption = {
  value: string;
  label: string;
  index: number;
};

/** Options for mapping dropdowns: real header names with column letter fallback. */
export function buildSpreadsheetColumnOptions(headerRow: string[]): SpreadsheetColumnOption[] {
  const colCount = Math.max(headerRow.length, 1);
  const options: SpreadsheetColumnOption[] = [];

  for (let i = 0; i < colCount; i++) {
    const letter = columnIndexToLetter(i);
    const header = (headerRow[i] ?? "").trim();
    const value = columnMappingValue(headerRow, i);
    const label = header !== "" ? `${header} (Column ${letter})` : `Column ${letter}`;
    options.push({ value, label, index: i });
  }

  return options;
}
