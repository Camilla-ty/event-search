import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { SponsorDetailView } from "@/src/features/sponsors/components/detail/SponsorDetailView";
import type { SponsorDetailData } from "@/src/features/sponsors/server/types";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";

function makeDetailData(
  overrides: Partial<SponsorDetailData> = {},
): SponsorDetailData {
  return {
    company: {
      id: COMPANY_ID,
      name: "Acme Corp",
      slug: "acme-corp",
      domain: "acme.com",
      website: "https://www.acme.com",
      logo_url: null,
      logo_source: null,
      logo_status: null,
      logo_fetched_at: null,
      logo_fetch_error: null,
      city_id: null,
      created_at: null,
      restricted_at: null,
      cities: null,
      industry: null,
    },
    isAuthenticated: false,
    summary: {
      sponsoredEditionCount: 0,
    },
    eventSeriesGroups: [],
    sameBrandSeriesLink: null,
    sameBrandSeries: null,
    relatedCompanies: [],
    ...overrides,
  };
}

describe("SponsorDetailView admin Edit link", () => {
  it("shows Edit for admins and links to the company admin route", () => {
    const html = renderToStaticMarkup(
      <SponsorDetailView data={makeDetailData()} showAdminEditLink />,
    );

    assert.match(html, /aria-label="Edit Acme Corp in admin"/);
    assert.match(html, /href="\/admin\/companies\/11111111-1111-4111-8111-111111111111"/);
    assert.match(html, />Edit</);
    assert.match(html, /flex flex-wrap items-start gap-x-3 gap-y-2/);
  });

  it("hides Edit for non-admin viewers", () => {
    const html = renderToStaticMarkup(
      <SponsorDetailView
        data={makeDetailData({ isAuthenticated: true })}
        showAdminEditLink={false}
      />,
    );

    assert.doesNotMatch(html, /aria-label="Edit Acme Corp in admin"/);
    assert.doesNotMatch(html, /href="\/admin\/companies\//);
    assert.doesNotMatch(html, />Edit</);
  });

  it("hides Edit for logged-out viewers", () => {
    const html = renderToStaticMarkup(
      <SponsorDetailView data={makeDetailData({ isAuthenticated: false })} />,
    );

    assert.doesNotMatch(html, /aria-label="Edit Acme Corp in admin"/);
    assert.doesNotMatch(html, /href="\/admin\/companies\//);
    assert.doesNotMatch(html, />Edit</);
  });
});

describe("Sponsor detail page admin Edit wiring", () => {
  it("gates the Edit link with getUser, getProfileRoleForUserId, and isAdminRole", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/(marketing)/sponsors/[slug]/page.tsx"),
      "utf8",
    );

    assert.match(source, /getProfileRoleForUserId/);
    assert.match(source, /isAdminRole/);
    assert.match(source, /showAdminEditLink/);
    assert.match(source, /getUser\(\)/);
    assert.doesNotMatch(source, /AdminEditBar/);
  });
});
