import assert from "node:assert/strict";

import type { ImportMatchShadowPersistedDecision } from "@/src/lib/companies/importMatchShadow/types";
import { collectParityDiffs } from "@/src/lib/companies/importMatchParity/assertParity";

/**
 * Deep compare of persisted shadow decisions. One differing field fails with a clear diff.
 */
export function assertImportMatchShadowEqual(
  actual: ImportMatchShadowPersistedDecision,
  expected: ImportMatchShadowPersistedDecision,
  label?: string,
): void {
  const diffs = collectParityDiffs(actual, expected);
  if (diffs.length === 0) return;

  const prefix = label ? `${label}: ` : "";
  assert.fail(
    `${prefix}import match shadow mismatch for row "${expected.row_id}" / importer "${expected.importer}":\n` +
      diffs.map((line) => `  - ${line}`).join("\n"),
  );
}

export function assertImportMatchShadowRowsEqual(
  actualRows: readonly ImportMatchShadowPersistedDecision[],
  expectedRows: readonly ImportMatchShadowPersistedDecision[],
  label = "shadow rows",
): void {
  if (actualRows.length !== expectedRows.length) {
    assert.fail(
      `${label}: row count actual=${actualRows.length} expected=${expectedRows.length}`,
    );
  }

  for (let index = 0; index < expectedRows.length; index += 1) {
    const expected = expectedRows[index];
    const actual = actualRows[index];
    assert.ok(expected, `${label}: missing expected row at ${index}`);
    assert.ok(actual, `${label}: missing actual row at ${index}`);
    assertImportMatchShadowEqual(
      actual,
      expected,
      `${label}[${index}] ${expected.row_id}/${expected.importer}`,
    );
  }
}
