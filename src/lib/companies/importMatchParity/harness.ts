import type { ImportMatchParityDecision } from "@/src/lib/companies/importMatchParity/types";
import {
  assertImportMatchParityEqual,
  assertImportMatchParityRowsEqual,
} from "@/src/lib/companies/importMatchParity/assertParity";

export {
  assertImportMatchParityEqual,
  assertImportMatchParityRowsEqual,
  collectParityDiffs,
} from "@/src/lib/companies/importMatchParity/assertParity";
export { runGoldenImportMatchParity } from "@/src/lib/companies/importMatchParity/goldenReference";
export type { GoldenReferenceInput } from "@/src/lib/companies/importMatchParity/goldenReference";

/**
 * Reusable Phase 0+ harness: compare a candidate implementation's decisions
 * against golden-reference decisions (row-by-row, field-by-field).
 */
export function assertParityAgainstGolden(
  actualRows: readonly ImportMatchParityDecision[],
  goldenRows: readonly ImportMatchParityDecision[],
  label = "candidate vs golden",
): void {
  assertImportMatchParityRowsEqual(actualRows, goldenRows, label);
}

/**
 * Compare two single decisions (e.g. one fixture × one importer).
 */
export function assertParityDecision(
  actual: ImportMatchParityDecision,
  golden: ImportMatchParityDecision,
  label?: string,
): void {
  assertImportMatchParityEqual(actual, golden, label);
}
