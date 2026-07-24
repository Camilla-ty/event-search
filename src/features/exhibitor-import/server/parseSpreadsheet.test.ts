import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { guessColumnMapping } from "./parseSpreadsheet";

describe("guessColumnMapping", () => {
  it("maps snake_case tier_rank and tier_label with Name and Website", () => {
    const mapping = guessColumnMapping(["tier_rank", "tier_label", "Name", "Website"]);
    assert.deepEqual(mapping, {
      tier_rank: "tier_rank",
      tier_label: "tier_label",
      company_name: "Name",
      website: "Website",
    });
  });

  it("maps spaced and exhibitor-prefixed headers", () => {
    const mapping = guessColumnMapping([
      "Exhibitor Tier",
      "Exhibitor Label",
      "Name",
      "Website",
    ]);
    assert.deepEqual(mapping, {
      tier_rank: "Exhibitor Tier",
      tier_label: "Exhibitor Label",
      company_name: "Name",
      website: "Website",
    });
  });

  it("maps Company name with exhibitor tier/label aliases", () => {
    const mapping = guessColumnMapping([
      "Exhibitor tier",
      "Exhibitor label",
      "Company name",
      "Website",
    ]);
    assert.deepEqual(mapping, {
      tier_rank: "Exhibitor tier",
      tier_label: "Exhibitor label",
      company_name: "Company name",
      website: "Website",
    });
  });

  it("returns null when a required column is missing", () => {
    assert.equal(guessColumnMapping(["tier_rank", "Name", "Website"]), null);
  });
});
