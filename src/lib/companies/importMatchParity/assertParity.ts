import assert from "node:assert/strict";

import type { ImportMatchParityDecision } from "@/src/lib/companies/importMatchParity/types";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatValue(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  return JSON.stringify(value);
}

/** Collect leaf path diffs between two JSON-compatible values. */
export function collectParityDiffs(
  actual: unknown,
  expected: unknown,
  path = "",
): string[] {
  if (Object.is(actual, expected)) {
    return [];
  }

  if (Array.isArray(actual) || Array.isArray(expected)) {
    if (!Array.isArray(actual) || !Array.isArray(expected)) {
      return [
        `${path || "(root)"}: type mismatch actual=${formatValue(actual)} expected=${formatValue(expected)}`,
      ];
    }
    if (actual.length !== expected.length) {
      return [
        `${path || "(root)"}.length: actual=${actual.length} expected=${expected.length}`,
      ];
    }
    const diffs: string[] = [];
    for (let index = 0; index < actual.length; index += 1) {
      diffs.push(...collectParityDiffs(actual[index], expected[index], `${path}[${index}]`));
    }
    return diffs;
  }

  if (isPlainObject(actual) || isPlainObject(expected)) {
    if (!isPlainObject(actual) || !isPlainObject(expected)) {
      return [
        `${path || "(root)"}: type mismatch actual=${formatValue(actual)} expected=${formatValue(expected)}`,
      ];
    }
    const keys = [...new Set([...Object.keys(actual), ...Object.keys(expected)])].sort();
    const diffs: string[] = [];
    for (const key of keys) {
      const nextPath = path ? `${path}.${key}` : key;
      if (!(key in actual)) {
        diffs.push(`${nextPath}: missing on actual (expected=${formatValue(expected[key])})`);
        continue;
      }
      if (!(key in expected)) {
        diffs.push(`${nextPath}: unexpected on actual (actual=${formatValue(actual[key])})`);
        continue;
      }
      diffs.push(...collectParityDiffs(actual[key], expected[key], nextPath));
    }
    return diffs;
  }

  return [
    `${path || "(root)"}: actual=${formatValue(actual)} expected=${formatValue(expected)}`,
  ];
}

/**
 * Deep row-by-row parity assert. Any single differing field fails with a clear diff.
 */
export function assertImportMatchParityEqual(
  actual: ImportMatchParityDecision,
  expected: ImportMatchParityDecision,
  label?: string,
): void {
  const diffs = collectParityDiffs(actual, expected);
  if (diffs.length === 0) return;

  const prefix = label ? `${label}: ` : "";
  assert.fail(
    `${prefix}import match parity mismatch for fixture "${expected.fixture_id}" / importer "${expected.importer}":\n` +
      diffs.map((line) => `  - ${line}`).join("\n"),
  );
}

/**
 * Compare two decision lists in fixture_id + importer order.
 * Length mismatch or any field diff fails.
 */
export function assertImportMatchParityRowsEqual(
  actualRows: readonly ImportMatchParityDecision[],
  expectedRows: readonly ImportMatchParityDecision[],
  label = "parity rows",
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
    assertImportMatchParityEqual(
      actual,
      expected,
      `${label}[${index}] ${expected.fixture_id}/${expected.importer}`,
    );
  }
}
