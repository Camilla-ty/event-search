import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { normalizeDomainFromWebsite } from "@/src/lib/domain/normalizeDomain";
import { resolveCompanyWebsiteIdentity } from "@/src/lib/domain/hostedPlatformWebsite";

const samples = [
  "moonpay.com",
  "MoonPay",
  "Amazon Web Services (AWS)",
  "nft.kred",
  ".kred",
  "",
  "https://moonpay.com",
  "AWS",
  "Opensea",
  "opensea.io",
];

describe("website normalization samples", () => {
  for (const sample of samples) {
    it(sample || "(empty)", () => {
      let pa: string | null = null;
      try {
        pa = sample ? normalizeDomainFromWebsite(sample) : null;
      } catch {
        pa = "THROW";
      }
      const sponsor = sample ? resolveCompanyWebsiteIdentity(sample) : null;
      console.log({
        sample,
        pa,
        sponsor:
          sponsor?.status === "domain"
            ? sponsor.domain
            : sponsor?.status ?? null,
      });
      assert.ok(true);
    });
  }
});
