import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assertMaterializeGuards, type ImportRowRecord } from "./batchGuards";

describe("assertMaterializeGuards", () => {
  it("blocks when unresolved rows remain", () => {
    const rows: ImportRowRecord[] = [
      {
        id: "1",
        status: "auto_ready",
        has_blocking_validation: false,
        duplicate_role: null,
        duplicate_resolution: null,
      },
      {
        id: "2",
        status: "resolved",
        has_blocking_validation: false,
        duplicate_role: null,
        duplicate_resolution: null,
      },
    ];

    assert.throws(() => assertMaterializeGuards(rows), /Import materialization blocked/);
  });

  it("blocks when no resolved rows exist", () => {
    const rows: ImportRowRecord[] = [
      {
        id: "1",
        status: "excluded",
        has_blocking_validation: false,
        duplicate_role: null,
        duplicate_resolution: null,
      },
    ];

    assert.throws(() => assertMaterializeGuards(rows), /Import materialization blocked/);
  });

  it("passes when only resolved rows remain", () => {
    const rows: ImportRowRecord[] = [
      {
        id: "1",
        status: "resolved",
        has_blocking_validation: false,
        duplicate_role: null,
        duplicate_resolution: null,
      },
      {
        id: "2",
        status: "excluded",
        has_blocking_validation: false,
        duplicate_role: null,
        duplicate_resolution: null,
      },
    ];

    assert.doesNotThrow(() => assertMaterializeGuards(rows));
  });
});
