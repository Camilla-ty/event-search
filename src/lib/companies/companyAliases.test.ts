import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appendCompanyAlias,
  findMatchingAlias,
  normalizeCompanyAliases,
  parseAliasesFromInput,
  resolveCompanySearchMatch,
} from "@/src/lib/companies/companyAliases";

describe("companyAliases", () => {
  it("normalizes and dedupes aliases", () => {
    assert.deepEqual(
      normalizeCompanyAliases(["Bitfarms", " bitfarms ", "Keel"], "Keel Infrastructure"),
      ["Bitfarms", "Keel"],
    );
  });

  it("drops alias equal to canonical name", () => {
    assert.deepEqual(
      normalizeCompanyAliases(["Keel Infrastructure"], "Keel Infrastructure"),
      [],
    );
  });

  it("parses comma and newline input", () => {
    assert.deepEqual(parseAliasesFromInput("Bitfarms, OldCo\nLegacy"), [
      "Bitfarms",
      "OldCo",
      "Legacy",
    ]);
  });

  it("appendCompanyAlias dedupes and blocks canonical name", () => {
    assert.deepEqual(appendCompanyAlias([], "Bitfarms", "Keel Infrastructure"), {
      ok: true,
      aliases: ["Bitfarms"],
    });
    assert.deepEqual(appendCompanyAlias(["Bitfarms"], "bitfarms", "Keel Infrastructure"), {
      ok: false,
      reason: "duplicate",
    });
    assert.deepEqual(
      appendCompanyAlias([], "Keel Infrastructure", "Keel Infrastructure"),
      { ok: false, reason: "canonical" },
    );
  });

  it("finds alias match for Keel / Bitfarms example", () => {
    const company = {
      name: "Keel Infrastructure",
      slug: "keel-infrastructure",
      domain: "keel.com",
      website: "https://keel.com",
      aliases: ["Bitfarms"],
    };

    assert.equal(findMatchingAlias(company.aliases, "Bitfarms"), "Bitfarms");
    assert.deepEqual(resolveCompanySearchMatch(company, "Bitfarms"), {
      matched_alias: "Bitfarms",
    });
    assert.deepEqual(resolveCompanySearchMatch(company, "Keel Infrastructure"), {
      matched_alias: null,
    });
  });
});
