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
  sameBrandSeriesLink: ReturnType<typeof buildPublicSameBrandSeriesLink>,
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
    sameBrandSeries: sameBrandSeriesLink
      ? {
          id: SERIES.id,
          slug: SERIES.slug,
          name: SERIES.name,
          lifecycle_status: SERIES.lifecycle_status,
        }
      : null,
  };
}

describe("same-brand public reciprocal UI (Participated Events prototype)", () => {
  it("does not show Series → Company reciprocal chrome on the Series hub header", () => {
    const html = renderToStaticMarkup(<SeriesHubHeader series={SERIES} />);
    assert.doesNotMatch(html, /Company profile/);
    assert.doesNotMatch(html, /\/sponsors\//);
  });

  it("does not show Company → Series reciprocal chrome on the Sponsor detail header", () => {
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
    assert.doesNotMatch(html, /Event profile/);
    assert.doesNotMatch(html, /\/events\/series\//);
  });

  it("still hides restricted company payloads at the builder layer", () => {
    const link = buildPublicSameBrandCompanyLink({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      slug: "secret-corp",
      name: "Secret Restricted Corp",
      status: "active",
      restricted_at: "2026-07-01T00:00:00.000Z",
      merged_into_company_id: null,
    });
    assert.equal(link, null);
  });
});
