import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  validateEditionCreateBody,
  validateEditionUpdateBody,
} from "@/src/lib/validation/eventEdition";

const CREATE_BASE = {
  series_id: "11111111-1111-1111-1111-111111111111",
  year: 2026,
  name: "Example 2026",
  slug: "example-2026",
};

describe("validateEditionCreateBody last_reviewed_at", () => {
  it("persists a provided Last reviewed date", () => {
    const result = validateEditionCreateBody({
      ...CREATE_BASE,
      last_reviewed_at: "2026-09-29",
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data.last_reviewed_at, "2026-09-29T00:00:00.000Z");
  });

  it("keeps last_reviewed_at NULL when empty or omitted", () => {
    const omitted = validateEditionCreateBody(CREATE_BASE);
    assert.equal(omitted.ok, true);
    if (!omitted.ok) return;
    assert.equal(omitted.data.last_reviewed_at, null);

    const empty = validateEditionCreateBody({
      ...CREATE_BASE,
      last_reviewed_at: "",
    });
    assert.equal(empty.ok, true);
    if (!empty.ok) return;
    assert.equal(empty.data.last_reviewed_at, null);
  });
});

describe("validateEditionUpdateBody last_reviewed_at", () => {
  it("includes last_reviewed_at in the patch only when provided", () => {
    const withDate = validateEditionUpdateBody({ last_reviewed_at: "2026-09-29" });
    assert.deepEqual(withDate, {
      ok: true,
      patch: { last_reviewed_at: "2026-09-29T00:00:00.000Z" },
    });

    const nameOnly = validateEditionUpdateBody({ name: "Example 2026" });
    assert.deepEqual(nameOnly, { ok: true, patch: { name: "Example 2026" } });
  });
});

describe("validateEditionUpdateBody logo policy", () => {
  it("rejects logo_url updates on event editions", () => {
    const result = validateEditionUpdateBody({
      logo_url: "https://example.com/logo.png",
    });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.errors.join("; "), /logo_url cannot be updated on event editions/i);
  });
});

describe("validateEditionUpdateBody sponsor_note_type", () => {
  it("accepts allowed sponsor note types and null", () => {
    assert.deepEqual(
      validateEditionUpdateBody({ sponsor_note_type: "upcoming_pending" }),
      { ok: true, patch: { sponsor_note_type: "upcoming_pending" } },
    );
    assert.deepEqual(validateEditionUpdateBody({ sponsor_note_type: null }), {
      ok: true,
      patch: { sponsor_note_type: null },
    });
    assert.deepEqual(validateEditionUpdateBody({ sponsor_note_type: "" }), {
      ok: true,
      patch: { sponsor_note_type: null },
    });
  });

  it("rejects unknown sponsor note types", () => {
    const result = validateEditionUpdateBody({ sponsor_note_type: "other" });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.errors.join("; "), /sponsor_note_type must be upcoming_pending or virtual_covid/i);
  });
});
