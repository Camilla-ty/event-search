import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatEventLastReviewedDate,
  formatPrimarySourceLink,
  toReviewedAtDateInputValue,
} from "@/src/features/events/lib/formatEventResearchMetadata";

describe("formatEventResearchMetadata", () => {
  it("formats last reviewed dates for public display", () => {
    assert.equal(
      formatEventLastReviewedDate("2026-06-30T12:34:56.000Z"),
      "Jun 30, 2026",
    );
    assert.equal(formatEventLastReviewedDate(null), null);
  });

  it("maps reviewed timestamps to date input values", () => {
    assert.equal(
      toReviewedAtDateInputValue("2026-06-30T12:34:56.000Z"),
      "2026-06-30",
    );
    assert.equal(toReviewedAtDateInputValue(""), "");
  });

  it("formats primary source links", () => {
    const link = formatPrimarySourceLink("https://www.example.com/path");
    assert.ok(link);
    assert.equal(link.href, "https://www.example.com/path");
    assert.equal(link.label, "example.com");
  });
});
