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
