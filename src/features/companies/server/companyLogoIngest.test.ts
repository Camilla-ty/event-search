import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EVENT_LOGO_AUTO_ENRICH_REJECTED_ERROR,
  EVENT_SERIES_LOGO_STORAGE_NAMESPACE,
} from "@/src/lib/events/eventLogoPolicy";

import { ingestCompanyLogoByDomain } from "./companyLogoIngest";

describe("ingestCompanyLogoByDomain event logo policy", () => {
  it("rejects event-series namespace (event logos are manual-only)", async () => {
    const result = await ingestCompanyLogoByDomain("example.com", {
      storageNamespace: EVENT_SERIES_LOGO_STORAGE_NAMESPACE,
    });

    assert.equal(result.status, "error");
    assert.equal(result.error, EVENT_LOGO_AUTO_ENRICH_REJECTED_ERROR);
    assert.equal(result.logoUrl, null);
  });

  it("rejects other non-company namespaces", async () => {
    const result = await ingestCompanyLogoByDomain("example.com", {
      storageNamespace: "other-namespace",
      companyId: "00000000-0000-4000-8000-000000000001",
    });

    assert.equal(result.status, "error");
    assert.equal(result.error, EVENT_LOGO_AUTO_ENRICH_REJECTED_ERROR);
  });
});

describe("ingestCompanyLogoByDomain hosted-platform guard", () => {
  const companyId = "00000000-0000-4000-8000-000000000001";

  it("skips Logo.dev/favicon/OG fetch for hosted-platform identity keys", async () => {
    const openSea = await ingestCompanyLogoByDomain("opensea.io/collection/nekocore", {
      companyId,
    });
    assert.equal(openSea.status, "skipped");
    assert.equal(openSea.logoUrl, null);
    assert.equal(openSea.strategy, null);

    const magicEden = await ingestCompanyLogoByDomain("magiceden.io/marketplace/nekocore", {
      companyId,
    });
    assert.equal(magicEden.status, "skipped");

    const linkedIn = await ingestCompanyLogoByDomain("linkedin.com/company/atlantic-hpc", {
      companyId,
    });
    assert.equal(linkedIn.status, "skipped");
  });

  it("still allows hostname-only corporate identities", async () => {
    const result = await ingestCompanyLogoByDomain("acme.com", {
      companyId,
      dryRun: true,
    });

    assert.notEqual(result.status, "skipped");
  });
});
