import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSponsorMetadataDescription,
  resolveSponsorWebsiteLabel,
  trimSponsorMetadataDescription,
} from "@/src/lib/seo/sponsorMetadata";

describe("resolveSponsorWebsiteLabel", () => {
  it("prefers domain and falls back to website hostname", () => {
    assert.equal(
      resolveSponsorWebsiteLabel({ domain: "bitgo.com", website: "https://other.test" }),
      "bitgo.com",
    );
    assert.equal(
      resolveSponsorWebsiteLabel({
        domain: null,
        website: "https://www.fireblocks.com/path",
      }),
      "fireblocks.com",
    );
    assert.equal(
      resolveSponsorWebsiteLabel({ domain: null, website: null }),
      null,
    );
  });
});

describe("trimSponsorMetadataDescription", () => {
  it("truncates long text near a word boundary", () => {
    const long =
      "Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon phi chi psi omega extra words here";
    const trimmed = trimSponsorMetadataDescription(long, 80);
    assert.ok(trimmed.length <= 81);
    assert.match(trimmed, /…$/);
    assert.doesNotMatch(trimmed, /\s…$/);
  });
});

describe("buildSponsorMetadataDescription", () => {
  it("prefers domain over sponsored count", () => {
    const description = buildSponsorMetadataDescription({
      name: "BitGo",
      domain: "bitgo.com",
      sponsoredEditionCount: 23,
    });
    assert.equal(
      description,
      "BitGo — bitgo.com. Company and sponsor intelligence on EventPixels.",
    );
    assert.doesNotMatch(description, /Sponsored 23/);
    assert.doesNotMatch(description, /industry/i);
  });

  it("derives the label from website when domain is missing", () => {
    const description = buildSponsorMetadataDescription({
      name: "Ledger",
      website: "https://www.ledger.com",
      sponsoredEditionCount: 8,
    });
    assert.equal(
      description,
      "Ledger — ledger.com. Company and sponsor intelligence on EventPixels.",
    );
  });

  it("uses sponsored event count when domain and website are missing", () => {
    const description = buildSponsorMetadataDescription({
      name: "Nexus Analytics",
      domain: null,
      website: null,
      sponsoredEditionCount: 1,
    });
    assert.equal(
      description,
      "Nexus Analytics. Sponsored 1 recorded event on EventPixels.",
    );
  });

  it("pluralizes sponsored event count", () => {
    const description = buildSponsorMetadataDescription({
      name: "Acme",
      sponsoredEditionCount: 12,
    });
    assert.equal(
      description,
      "Acme. Sponsored 12 recorded events on EventPixels.",
    );
  });

  it("uses generic fallback when count is zero or unknown", () => {
    assert.equal(
      buildSponsorMetadataDescription({
        name: "Acme Robotics",
        sponsoredEditionCount: 0,
      }),
      "Acme Robotics. Company and sponsor intelligence on EventPixels.",
    );
    assert.equal(
      buildSponsorMetadataDescription({
        name: "BitGo",
        domain: null,
        sponsoredEditionCount: 0,
        sponsoredEditionCountUnknown: true,
      }),
      "BitGo. Company and sponsor intelligence on EventPixels.",
    );
  });

  it("never depends on industry and never includes gated event names", () => {
    const description = buildSponsorMetadataDescription({
      name: "Fireblocks",
      domain: "fireblocks.com",
      sponsoredEditionCount: 40,
    });
    assert.doesNotMatch(description, /industry/i);
    assert.doesNotMatch(
      description,
      /BTC Prague|Consensus|Bitcoin Conference|sponsored events include/i,
    );
    assert.equal(
      description,
      "Fireblocks — fireblocks.com. Company and sponsor intelligence on EventPixels.",
    );
  });
});
