import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPublicSameBrandCompanyLink,
  buildPublicSameBrandSeriesLink,
} from "@/src/lib/companies/sameBrandPublicLink";

const ACTIVE_COMPANY = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  slug: "token2049",
  name: "TOKEN2049",
  status: "active",
  restricted_at: null,
  merged_into_company_id: null,
};

const ACTIVE_SERIES = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  slug: "token2049",
  name: "TOKEN2049",
  lifecycle_status: "active",
};

describe("buildPublicSameBrandCompanyLink", () => {
  it("returns a visible Series → Company link for a safe company", () => {
    assert.deepEqual(buildPublicSameBrandCompanyLink(ACTIVE_COMPANY), {
      href: "/sponsors/token2049",
      name: "TOKEN2049",
    });
  });

  it("hides restricted companies without exposing a name or href", () => {
    const result = buildPublicSameBrandCompanyLink({
      ...ACTIVE_COMPANY,
      restricted_at: "2026-07-01T00:00:00.000Z",
    });
    assert.equal(result, null);
  });

  it("hides merged or inactive companies", () => {
    assert.equal(
      buildPublicSameBrandCompanyLink({
        ...ACTIVE_COMPANY,
        status: "merged",
        merged_into_company_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      }),
      null,
    );
    assert.equal(
      buildPublicSameBrandCompanyLink({
        ...ACTIVE_COMPANY,
        status: "inactive",
      }),
      null,
    );
  });

  it("returns null when there is no relationship candidate", () => {
    assert.equal(buildPublicSameBrandCompanyLink(null), null);
    assert.equal(buildPublicSameBrandCompanyLink(undefined), null);
  });
});

describe("buildPublicSameBrandSeriesLink", () => {
  it("returns a visible Company → Series link for a public event brand", () => {
    assert.deepEqual(buildPublicSameBrandSeriesLink(ACTIVE_SERIES), {
      href: "/events/series/token2049",
      name: "TOKEN2049",
    });
  });

  it("hides merged / unavailable series destinations", () => {
    assert.equal(
      buildPublicSameBrandSeriesLink({
        ...ACTIVE_SERIES,
        lifecycle_status: "merged",
      }),
      null,
    );
  });

  it("allows discontinued series hubs (still public destinations)", () => {
    assert.deepEqual(
      buildPublicSameBrandSeriesLink({
        ...ACTIVE_SERIES,
        lifecycle_status: "discontinued",
      }),
      {
        href: "/events/series/token2049",
        name: "TOKEN2049",
      },
    );
  });

  it("returns null when there is no relationship candidate", () => {
    assert.equal(buildPublicSameBrandSeriesLink(null), null);
  });
});
