import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  duplicateClusterKey,
  finalizeImportRowWebsites,
  normalizeWebsiteClusterKey,
  selectImportCanonicalWebsite,
  shouldMergeWebsiteCandidates,
} from "./importWebsiteSelection";
import { assignDuplicateClusters, validateRow, type ValidatedImportRow } from "./validateRows";

describe("selectImportCanonicalWebsite", () => {
  it("prefers sorare.com over games.gg", () => {
    assert.equal(
      selectImportCanonicalWebsite([
        "https://games.gg/sorare",
        "https://www.sorare.com",
      ]),
      "https://www.sorare.com",
    );
  });

  it("prefers symbiogenesis.app over games.gg", () => {
    assert.equal(
      selectImportCanonicalWebsite([
        "https://games.gg/symbiogenesis",
        "https://symbiogenesis.app",
      ]),
      "https://symbiogenesis.app",
    );
  });
});

describe("shouldMergeWebsiteCandidates", () => {
  it("merges when official and directory URLs share a company name", () => {
    assert.equal(
      shouldMergeWebsiteCandidates([
        "https://games.gg/sorare",
        "https://sorare.com",
      ]),
      true,
    );
  });

  it("does not merge same-tier no_identity URLs with different paths", () => {
    assert.equal(
      shouldMergeWebsiteCandidates([
        "https://coinmarketcap.com/currencies/token-a/",
        "https://coinmarketcap.com/currencies/token-b/",
      ]),
      false,
    );
  });
});

describe("normalizeWebsiteClusterKey", () => {
  it("keeps distinct keys for different no_identity directory URLs", () => {
    const a = normalizeWebsiteClusterKey(
      "https://coinmarketcap.com/currencies/token-a/",
    );
    const b = normalizeWebsiteClusterKey(
      "https://coinmarketcap.com/currencies/token-b/",
    );
    assert.notEqual(a, b);
  });

  it("matches the same no_identity URL with trailing slash differences", () => {
    assert.equal(
      normalizeWebsiteClusterKey("https://games.gg/game/sorare/"),
      normalizeWebsiteClusterKey("https://www.games.gg/game/sorare"),
    );
  });
});

describe("assignDuplicateClusters website selection", () => {
  function validatedRow(params: {
    id: string;
    excel_row_number: number;
    name: string;
    website: string;
    tier?: number;
  }): ValidatedImportRow {
    const validated = validateRow({
      id: params.id,
      excel_row_number: params.excel_row_number,
      raw_company_name: params.name,
      raw_website: params.website,
      raw_tier_rank: params.tier ?? 1,
      raw_tier_label: null,
      status: "needs_review",
    });
    return {
      ...validated,
      id: params.id,
      excel_row_number: params.excel_row_number,
      status: "needs_review",
    };
  }

  it("chooses sorare.com over games.gg for import candidates with the same company name", () => {
    const rows = assignDuplicateClusters([
      validatedRow({
        id: "row-1",
        excel_row_number: 10,
        name: "Sorare",
        website: "https://games.gg/sorare",
      }),
      validatedRow({
        id: "row-2",
        excel_row_number: 11,
        name: "Sorare",
        website: "https://www.sorare.com",
      }),
    ]);

    for (const row of rows) {
      assert.equal(row.normalized_website, "https://www.sorare.com");
      assert.equal(row.normalized_domain, "sorare.com");
    }
  });

  it("chooses symbiogenesis.app over games.gg for import candidates with the same company name", () => {
    const rows = assignDuplicateClusters([
      validatedRow({
        id: "row-1",
        excel_row_number: 10,
        name: "Symbiogenesis",
        website: "https://games.gg/symbiogenesis",
      }),
      validatedRow({
        id: "row-2",
        excel_row_number: 11,
        name: "Symbiogenesis",
        website: "https://symbiogenesis.app",
      }),
    ]);

    for (const row of rows) {
      assert.equal(row.normalized_website, "https://symbiogenesis.app");
      assert.equal(row.normalized_domain, "symbiogenesis.app");
    }
  });

  it("retains CoinMarketCap-only as fallback website with null domain", () => {
    const cmc = "https://coinmarketcap.com/currencies/example-token/";
    const rows = assignDuplicateClusters([
      validatedRow({
        id: "row-1",
        excel_row_number: 10,
        name: "Example Token",
        website: cmc,
      }),
    ]);

    assert.equal(rows[0]?.normalized_website, cmc);
    assert.equal(rows[0]?.normalized_domain, null);
    assert.ok(
      rows[0]?.validation_issues.some((issue) => issue.type === "community_website"),
    );
  });

  it("retains games.gg-only as fallback website when no official site exists", () => {
    const games = "https://games.gg/solo-project";
    const rows = assignDuplicateClusters([
      validatedRow({
        id: "row-1",
        excel_row_number: 10,
        name: "Solo Project",
        website: games,
      }),
    ]);

    assert.equal(rows[0]?.normalized_website, games);
    assert.equal(rows[0]?.normalized_domain, null);
  });

  it("retains Mirror.xyz-only as hosted fallback with path identity", () => {
    const mirror = "https://mirror.xyz/eth/0xabc123";
    const rows = assignDuplicateClusters([
      validatedRow({
        id: "row-1",
        excel_row_number: 10,
        name: "Mirror Project",
        website: mirror,
      }),
    ]);

    assert.equal(rows[0]?.normalized_website, mirror);
    assert.equal(rows[0]?.normalized_domain, "mirror.xyz/eth/0xabc123");
  });

  it("does not cluster distinct no_identity URLs that share only a company name", () => {
    const rows = assignDuplicateClusters([
      validatedRow({
        id: "row-1",
        excel_row_number: 10,
        name: "Token Co",
        website: "https://coinmarketcap.com/currencies/token-a/",
      }),
      validatedRow({
        id: "row-2",
        excel_row_number: 11,
        name: "Token Co",
        website: "https://coinmarketcap.com/currencies/token-b/",
      }),
    ]);

    assert.equal(rows.find((r) => r.id === "row-1")?.duplicate_role, null);
    assert.equal(rows.find((r) => r.id === "row-2")?.duplicate_role, null);
    assert.notEqual(
      duplicateClusterKey(rows[0]!),
      duplicateClusterKey(rows[1]!),
    );
  });

  it("clusters identical no_identity fallback URLs on normalized website key", () => {
    const games = "https://games.gg/shared-listing";
    const rows = assignDuplicateClusters([
      validatedRow({
        id: "row-1",
        excel_row_number: 10,
        name: "Listing A",
        website: games,
        tier: 2,
      }),
      validatedRow({
        id: "row-2",
        excel_row_number: 11,
        name: "Listing B",
        website: games,
        tier: 3,
      }),
    ]);

    assert.equal(rows.find((r) => r.id === "row-1")?.duplicate_resolution, "kept");
    assert.equal(rows.find((r) => r.id === "row-2")?.duplicate_resolution, "excluded");
    assert.equal(rows.find((r) => r.id === "row-2")?.duplicate_of_row_id, "row-1");
  });
});

describe("finalizeImportRowWebsites", () => {
  it("aligns domain with canonical website selection", () => {
    const rows = finalizeImportRowWebsites([
      {
        normalized_company_name: "Sorare",
        normalized_website: "https://games.gg/sorare",
        normalized_domain: null,
      },
      {
        normalized_company_name: "Sorare",
        normalized_website: "https://sorare.com",
        normalized_domain: "sorare.com",
      },
    ]);

    assert.equal(rows[0]?.normalized_website, "https://sorare.com");
    assert.equal(rows[0]?.normalized_domain, "sorare.com");
    assert.equal(rows[1]?.normalized_website, "https://sorare.com");
  });
});
