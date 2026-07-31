import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { SeriesHubHeader } from "@/src/features/events/components/series/SeriesHubHeader";
import { SponsorDetailView } from "@/src/features/sponsors/components/detail/SponsorDetailView";
import type { SponsorDetailData } from "@/src/features/sponsors/server/types";
import type { PublicEventSeriesSummary } from "@/src/features/events/types/publicEdition";
import {
  buildPublicSameBrandCompanyLink,
  buildPublicSameBrandSeriesLink,
  type PublicSameBrandLink,
} from "@/src/lib/companies/sameBrandPublicLink";

const SERIES: PublicEventSeriesSummary = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  slug: "token2049",
  name: "TOKEN2049",
  website_url: null,
  logo_url: null,
  lifecycle_status: "active",
  merged_into_series: null,
};

function sponsorDetailData(
  sameBrandSeriesLink: PublicSameBrandLink | null,
): SponsorDetailData {
  return {
    company: {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      name: "TOKEN2049",
      slug: "token2049",
      domain: "token2049.com",
      website: "https://token2049.com",
      logo_url: null,
      logo_source: null,
      logo_status: null,
      logo_fetched_at: null,
      logo_fetch_error: null,
      city_id: null,
      created_at: "2026-01-01T00:00:00.000Z",
      restricted_at: null,
      cities: null,
    },
    isAuthenticated: false,
    summary: { sponsoredEditionCount: 0 },
    eventSeriesGroups: [],
    sameBrandSeriesLink,
  };
}

describe("same-brand public reciprocal UI (SB2)", () => {
  it("shows Series → Company profile link with company wording", () => {
    const link = buildPublicSameBrandCompanyLink({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      slug: "token2049",
      name: "TOKEN2049 Ltd",
      status: "active",
      restricted_at: null,
      merged_into_company_id: null,
    });
    assert.ok(link);

    const html = renderToStaticMarkup(
      <SeriesHubHeader series={SERIES} sameBrandCompanyLink={link} />,
    );

    assert.match(html, /Company profile/);
    assert.match(html, /href="\/sponsors\/token2049"/);
    assert.match(html, /TOKEN2049 Ltd/);
    assert.doesNotMatch(html, /organizer|owner/i);
  });

  it("shows Company → Series event profile link", () => {
    const link = buildPublicSameBrandSeriesLink({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      slug: "token2049",
      name: "TOKEN2049",
      lifecycle_status: "active",
    });
    assert.ok(link);

    const html = renderToStaticMarkup(
      <SponsorDetailView data={sponsorDetailData(link)} />,
    );

    assert.match(html, /Event profile/);
    assert.match(html, /href="\/events\/series\/token2049"/);
    assert.match(html, /TOKEN2049/);
  });

  it("hides the Series → Company link when the target is restricted", () => {
    const link = buildPublicSameBrandCompanyLink({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      slug: "secret-corp",
      name: "Secret Restricted Corp",
      status: "active",
      restricted_at: "2026-07-01T00:00:00.000Z",
      merged_into_company_id: null,
    });
    assert.equal(link, null);

    const html = renderToStaticMarkup(
      <SeriesHubHeader series={SERIES} sameBrandCompanyLink={link} />,
    );

    assert.doesNotMatch(html, /Company profile/);
    assert.doesNotMatch(html, /Secret Restricted Corp/);
    assert.doesNotMatch(html, /secret-corp/);
    assert.doesNotMatch(html, /\/sponsors\//);
  });

  it("hides the Company → Series link when the series is merged / unavailable", () => {
    const link = buildPublicSameBrandSeriesLink({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      slug: "old-merged-brand",
      name: "Old Merged Brand",
      lifecycle_status: "merged",
    });
    assert.equal(link, null);

    const html = renderToStaticMarkup(
      <SponsorDetailView data={sponsorDetailData(link)} />,
    );

    assert.doesNotMatch(html, /Event profile/);
    assert.doesNotMatch(html, /Old Merged Brand/);
    assert.doesNotMatch(html, /old-merged-brand/);
    assert.doesNotMatch(html, /\/events\/series\//);
  });

  it("renders neither reciprocal link when there is no relationship", () => {
    const seriesHtml = renderToStaticMarkup(
      <SeriesHubHeader series={SERIES} sameBrandCompanyLink={null} />,
    );
    const companyHtml = renderToStaticMarkup(
      <SponsorDetailView data={sponsorDetailData(null)} />,
    );

    assert.doesNotMatch(seriesHtml, /Company profile/);
    assert.doesNotMatch(companyHtml, /Event profile/);
  });

  it("does not leak restricted company fields through a public same-brand payload", () => {
    const restrictedCandidate = {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      slug: "leaky-restricted",
      name: "Leaky Restricted Name",
      status: "active",
      restricted_at: "2026-07-01T00:00:00.000Z",
      merged_into_company_id: null,
    };
    const link = buildPublicSameBrandCompanyLink(restrictedCandidate);
    assert.equal(link, null);

    const payload = {
      sameBrandCompanyLink: link,
      sameBrandSeriesLink: null,
    };
    const serialized = JSON.stringify(payload);
    assert.doesNotMatch(serialized, /Leaky Restricted Name/);
    assert.doesNotMatch(serialized, /leaky-restricted/);
    assert.doesNotMatch(serialized, /restricted_at/);
  });
});
