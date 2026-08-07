import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { SponsorDetailView } from "@/src/features/sponsors/components/detail/SponsorDetailView";
import type { SponsorDetailData } from "@/src/features/sponsors/server/types";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const RELATED_ID = "22222222-2222-4222-8222-222222222222";
const RELATED_ID_B = "33333333-3333-4333-8333-333333333333";

function makeCompany(
  overrides: Partial<SponsorDetailData["company"]> &
    Pick<SponsorDetailData["company"], "id" | "name" | "slug">,
): SponsorDetailData["company"] {
  return {
    domain: null,
    website: null,
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
    ...overrides,
  };
}

function makeDetailData(
  overrides: Partial<SponsorDetailData> = {},
): SponsorDetailData {
  return {
    company: makeCompany({
      id: COMPANY_ID,
      name: "Acme Corp",
      slug: "acme-corp",
      domain: "acme.com",
      website: "https://www.acme.com",
    }),
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

describe("SponsorDetailView related companies", () => {
  it("hides the section when relatedCompanies is empty", () => {
    const html = renderToStaticMarkup(
      <SponsorDetailView data={makeDetailData()} />,
    );
    assert.doesNotMatch(html, />Related Companies</);
  });

  it("renders a bottom horizontal rail with logo, name, and public links", () => {
    const html = renderToStaticMarkup(
      <SponsorDetailView
        data={makeDetailData({
          relatedCompanies: [
            makeCompany({
              id: RELATED_ID,
              name: "Acme Labs",
              slug: "acme-labs",
            }),
            makeCompany({
              id: RELATED_ID_B,
              name: "Acme Ventures",
              slug: "acme-ventures",
            }),
          ],
        })}
      />,
    );

    assert.match(html, />Related Companies</);
    assert.match(html, /Acme Labs/);
    assert.match(html, /Acme Ventures/);
    assert.match(html, /href="\/sponsors\/acme-labs"/);
    assert.match(html, /href="\/sponsors\/acme-ventures"/);
    assert.match(html, /overflow-x-auto/);
    assert.match(html, /snap-x/);
    assert.match(html, /hover:shadow-md/);
    assert.doesNotMatch(html, /closely related/i);

    const relatedSection = html.slice(html.indexOf('aria-labelledby="related-companies-heading"'));
    assert.doesNotMatch(relatedSection, /grid-cols/);
    assert.match(relatedSection, /flex gap-3 overflow-x-auto/);

    const relatedIdx = html.indexOf("Related Companies");
    const sponsorshipIdx = html.indexOf("Sponsorship history");
    assert.ok(relatedIdx > -1 && sponsorshipIdx > -1);
    assert.ok(
      relatedIdx > sponsorshipIdx,
      "Related Companies should render after Sponsorship history",
    );
  });
});

describe("RelatedCompaniesRail module", () => {
  it("is wired from SponsorDetailView", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/features/sponsors/components/detail/SponsorDetailView.tsx",
      ),
      "utf8",
    );
    assert.match(source, /RelatedCompaniesRail/);
    assert.match(source, /relatedCompanies/);
  });
});

describe("listPublicRelatedCompanies module", () => {
  it("is used by getSponsorDetailData", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/features/sponsors/server/getSponsorDetailData.ts"),
      "utf8",
    );
    assert.match(source, /listPublicRelatedCompaniesForCompany/);
    assert.match(source, /relatedCompanies/);
  });
});
