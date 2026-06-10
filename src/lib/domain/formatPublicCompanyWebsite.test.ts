import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatPublicCompanyWebsite } from "./formatPublicCompanyWebsite";

describe("formatPublicCompanyWebsite", () => {
  it("uses clean domain label and preserves full website href", () => {
    const result = formatPublicCompanyWebsite({
      website: "https://www.bybit.com/",
      domain: "bybit.com",
    });
    assert.ok(result);
    assert.equal(result.label, "bybit.com");
    assert.equal(result.href, "https://www.bybit.com/");
  });

  it("strips path from label but keeps path in href", () => {
    const result = formatPublicCompanyWebsite({
      website: "https://circle.com/about",
      domain: "circle.com",
    });
    assert.ok(result);
    assert.equal(result.label, "circle.com");
    assert.equal(result.href, "https://circle.com/about");
  });

  it("falls back to https://domain when website is empty", () => {
    const result = formatPublicCompanyWebsite({
      website: null,
      domain: "fireblocks.com",
    });
    assert.ok(result);
    assert.equal(result.label, "fireblocks.com");
    assert.equal(result.href, "https://fireblocks.com");
  });

  it("parses website without protocol", () => {
    const result = formatPublicCompanyWebsite({
      website: "token2049.com/events",
      domain: "token2049.com",
    });
    assert.ok(result);
    assert.equal(result.label, "token2049.com");
    assert.equal(result.href, "https://token2049.com/events");
  });

  it("returns null when both website and domain are missing", () => {
    assert.equal(formatPublicCompanyWebsite({ website: "", domain: "" }), null);
    assert.equal(formatPublicCompanyWebsite({}), null);
  });

  it("falls back to domain href when website does not parse", () => {
    const result = formatPublicCompanyWebsite({
      website: "not a valid url",
      domain: "example.com",
    });
    assert.ok(result);
    assert.equal(result.label, "example.com");
    assert.equal(result.href, "https://example.com");
  });

  it("derives label from website when domain is missing", () => {
    const result = formatPublicCompanyWebsite({
      website: "https://www.fireblocks.com/?utm=campaign",
      domain: null,
    });
    assert.ok(result);
    assert.equal(result.label, "fireblocks.com");
    assert.equal(result.href, "https://www.fireblocks.com/?utm=campaign");
  });
});
