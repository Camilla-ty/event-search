import { describe, expect, it } from "vitest";

import { guessColumnMapping } from "./parseSpreadsheet";

describe("guessColumnMapping", () => {
  it("maps snake_case tier_rank and tier_label with Name and Website", () => {
    const mapping = guessColumnMapping(["tier_rank", "tier_label", "Name", "Website"]);
    expect(mapping).toEqual({
      tier_rank: "tier_rank",
      tier_label: "tier_label",
      company_name: "Name",
      website: "Website",
    });
  });

  it("maps spaced and sponsor-prefixed headers", () => {
    const mapping = guessColumnMapping([
      "Sponsor tier",
      "Sponsor label",
      "Company name",
      "Website",
    ]);
    expect(mapping).toEqual({
      tier_rank: "Sponsor tier",
      tier_label: "Sponsor label",
      company_name: "Company name",
      website: "Website",
    });
  });

  it("returns null when a required column is missing", () => {
    expect(guessColumnMapping(["tier_rank", "Name", "Website"])).toBeNull();
  });
});
