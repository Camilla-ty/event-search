import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

/**
 * Guards the removal of the Bitcoin × Asia MVP layer.
 * The hub is now generic over topic × region; reintroducing a single
 * hardcoded hub would silently bypass the research-page + gate pipeline.
 */

const SRC_ROOT = join(process.cwd(), "src");

/** Symbols from the deleted MVP layer. Banned everywhere, tests included. */
const BANNED_SYMBOLS = [
  /bitcoinAsiaHub/,
  /BitcoinAsiaHub/,
  /BITCOIN_ASIA_/,
  /getBitcoinAsiaHubIndexability/,
];

/**
 * The dead hub URL. Banned in production sources only: a handful of pure
 * path-formatter tests still pass "bitcoin" as an arbitrary slug argument.
 */
const BANNED_PATH = /\/events\/topics\/bitcoin\//;

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(path));
      continue;
    }
    if (/\.tsx?$/.test(entry.name)) files.push(path);
  }
  return files;
}

const isTestFile = (path: string) => /\.test\.tsx?$/.test(path);

/** This file spells the banned patterns out, so it cannot scan itself. */
const isGuardFile = (path: string) =>
  path.endsWith("topicRegionHub.noBitcoinRegression.test.ts");

describe("Bitcoin × Asia hub removal", () => {
  const files = collectSourceFiles(SRC_ROOT).filter(
    (path) => !isGuardFile(path),
  );

  it("finds source files to scan", () => {
    assert.ok(files.length > 0, "expected to scan at least one source file");
  });

  it("has no remaining references to the deleted MVP symbols", () => {
    for (const path of files) {
      const source = readFileSync(path, "utf8");
      for (const pattern of BANNED_SYMBOLS) {
        assert.doesNotMatch(
          source,
          pattern,
          `${pattern} reintroduced in ${path}`,
        );
      }
    }
  });

  it("has no production reference to the dead /events/topics/bitcoin/ path", () => {
    for (const path of files) {
      if (isTestFile(path)) continue;
      assert.doesNotMatch(
        readFileSync(path, "utf8"),
        BANNED_PATH,
        `dead Bitcoin hub path reintroduced in ${path}`,
      );
    }
  });

  it("no longer ships the bitcoin-asia component directory", () => {
    assert.throws(() =>
      readdirSync(join(SRC_ROOT, "features/events/components/bitcoin-asia")),
    );
  });
});
