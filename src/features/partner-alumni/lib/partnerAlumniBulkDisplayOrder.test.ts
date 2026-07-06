import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolvePartnerAlumniBulkDisplayOrders,
  sortPartnerAlumniBulkCommitEntries,
} from "@/src/features/partner-alumni/lib/partnerAlumniBulkDisplayOrder";

describe("sortPartnerAlumniBulkCommitEntries", () => {
  it("sorts by display_order then row_number", () => {
    const sorted = sortPartnerAlumniBulkCommitEntries([
      { row_number: 3, display_order: null, name: "c" },
      { row_number: 1, display_order: 2, name: "a" },
      { row_number: 2, display_order: 10, name: "b" },
    ] as never[]);

    assert.deepEqual(
      sorted.map((row) => row.row_number),
      [1, 2, 3],
    );
  });
});

describe("resolvePartnerAlumniBulkDisplayOrders", () => {
  it("appends after existing roster when file has no display_order", () => {
    const orders = resolvePartnerAlumniBulkDisplayOrders([1, 2, 3], [
      { display_order: null, row_number: 10 },
      { display_order: null, row_number: 11 },
    ]);
    assert.deepEqual(orders, [4, 5]);
  });

  it("uses file display_order values when provided", () => {
    const orders = resolvePartnerAlumniBulkDisplayOrders([], [
      { display_order: 5, row_number: 2 },
      { display_order: 2, row_number: 1 },
    ]);
    assert.deepEqual(orders, [5, 2]);
  });

  it("fills implicit order for mixed rows after explicit values", () => {
    const orders = resolvePartnerAlumniBulkDisplayOrders([1], [
      { display_order: 3, row_number: 1 },
      { display_order: null, row_number: 2 },
    ]);
    assert.deepEqual(orders, [3, 4]);
  });
});
