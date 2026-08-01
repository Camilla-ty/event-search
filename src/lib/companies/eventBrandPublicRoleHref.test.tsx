import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { EventOrganizerListItem } from "@/src/features/events/components/detail/EventOrganizerListItem";
import { PublicSponsorRosterRow } from "@/src/features/events/components/detail/PublicSponsorRosterRow";
import { PublicExhibitorRosterRow } from "@/src/features/exhibitors/components/detail/PublicExhibitorRosterRow";
import { EventPartnerAlumniSection } from "@/src/features/partner-alumni/components/detail/EventPartnerAlumniSection";
import {
  buildPublicCompanyRoleHref,
  type EventBrandPublicDestinationIndex,
} from "@/src/lib/companies/eventBrandPublicDestinationIndex";
import { mapPublicSponsorSearchItem } from "@/src/features/events/server/publicSponsorSearch";

const SFF_ID = "f85bff6d-f25a-40c5-839f-4a395fbb3d37";
const SFF_SLUG = "singapore-fintech-festival";
const SFF_APPROVED_AT = "2026-08-01T11:19:34.191394+00";

const SFF_SERIES = {
  id: "78232c5b-7ef2-4cda-a23a-941387e1a9c1",
  name: "Singapore Fintech Festival",
  slug: SFF_SLUG,
  lifecycle_status: "active",
};

function sffIndex(
  series: typeof SFF_SERIES | null = SFF_SERIES,
): EventBrandPublicDestinationIndex {
  return new Map([
    [
      SFF_ID,
      {
        approvedAt: SFF_APPROVED_AT,
        series,
      },
    ],
  ]);
}

describe("buildPublicCompanyRoleHref (ADR-005 EB4)", () => {
  it("routes approved Event Brand Sponsor links to the Series hub root", () => {
    const href = buildPublicCompanyRoleHref(
      {
        id: SFF_ID,
        slug: SFF_SLUG,
        restricted_at: null,
      },
      sffIndex(),
    );
    assert.equal(href, "/events/series/singapore-fintech-festival");
    assert.doesNotMatch(href!, /\?/);
  });

  it("keeps normal Sponsor links on /sponsors/{slug}", () => {
    const href = buildPublicCompanyRoleHref(
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        slug: "acme-corp",
        restricted_at: null,
        event_brand_public_profile_approved_at: null,
      },
      sffIndex(),
    );
    assert.equal(href, "/sponsors/acme-corp");
  });

  it("falls back to Sponsor profile when approved Series is unavailable", () => {
    const merged = buildPublicCompanyRoleHref(
      { id: SFF_ID, slug: SFF_SLUG, restricted_at: null },
      sffIndex({ ...SFF_SERIES, lifecycle_status: "merged" }),
    );
    assert.equal(merged, "/sponsors/singapore-fintech-festival");

    const missing = buildPublicCompanyRoleHref(
      { id: SFF_ID, slug: SFF_SLUG, restricted_at: null },
      sffIndex(null),
    );
    assert.equal(missing, "/sponsors/singapore-fintech-festival");
  });

  it("returns null for restricted Companies", () => {
    assert.equal(
      buildPublicCompanyRoleHref({
        id: SFF_ID,
        slug: SFF_SLUG,
        restricted_at: "2026-07-11T00:00:00.000Z",
        public_href: undefined,
      }),
      null,
    );
    assert.equal(
      buildPublicCompanyRoleHref({
        id: SFF_ID,
        slug: SFF_SLUG,
        restricted_at: null,
        public_href: null,
      }),
      null,
    );
  });

  it("prefers server-attached public_href without a query string", () => {
    const href = buildPublicCompanyRoleHref({
      id: SFF_ID,
      slug: SFF_SLUG,
      public_href: "/events/series/singapore-fintech-festival",
    });
    assert.equal(href, "/events/series/singapore-fintech-festival");
    assert.doesNotMatch(href!, /\?tab=/);
  });
});

describe("public role surface wiring (ADR-005 EB4)", () => {
  it("wires PublicSponsorRosterRow approved Event Brand → Series hub", () => {
    const html = renderToStaticMarkup(
      <ul>
        <PublicSponsorRosterRow
          sponsor={{
            id: "sponsor-sff",
            company_id: SFF_ID,
            companies: {
              id: SFF_ID,
              slug: SFF_SLUG,
              name: "Singapore FinTech Festival",
              domain: "fintechfestival.sg",
              restricted_at: null,
              public_href: "/events/series/singapore-fintech-festival",
            },
          }}
        />
      </ul>,
    );
    assert.match(html, /href="\/events\/series\/singapore-fintech-festival"/);
    assert.doesNotMatch(html, /href="\/sponsors\/singapore-fintech-festival"/);
    assert.doesNotMatch(html, /\?tab=/);
  });

  it("wires PublicSponsorRosterRow normal Sponsor → Sponsor profile", () => {
    const html = renderToStaticMarkup(
      <ul>
        <PublicSponsorRosterRow
          sponsor={{
            id: "sponsor-1",
            company_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            companies: {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              slug: "acme-corp",
              name: "Acme Corp",
              domain: "acme.com",
              restricted_at: null,
            },
          }}
        />
      </ul>,
    );
    assert.match(html, /href="\/sponsors\/acme-corp"/);
  });

  it("wires Organizer list item through the resolver", () => {
    const html = renderToStaticMarkup(
      <ul>
        <EventOrganizerListItem
          organizer={{
            id: "org-1",
            role_label: "Organizer",
            display_order: 1,
            company: {
              id: SFF_ID,
              slug: SFF_SLUG,
              name: "Singapore FinTech Festival",
              public_href: "/events/series/singapore-fintech-festival",
            },
          }}
        />
      </ul>,
    );
    assert.match(html, /href="\/events\/series\/singapore-fintech-festival"/);
    assert.match(html, /Organizer/);
  });

  it("wires Exhibitor roster row through the resolver", () => {
    const html = renderToStaticMarkup(
      <ul>
        <PublicExhibitorRosterRow
          exhibitor={{
            id: "ex-1",
            company_id: SFF_ID,
            tier_rank: 1,
            tier_label: null,
            display_order: 1,
            company: {
              id: SFF_ID,
              slug: SFF_SLUG,
              name: "Singapore FinTech Festival",
              domain: null,
              website: null,
              restricted_at: null,
              logo_url: null,
              logo_source: null,
              logo_status: null,
              public_href: "/events/series/singapore-fintech-festival",
            },
          }}
        />
      </ul>,
    );
    assert.match(html, /href="\/events\/series\/singapore-fintech-festival"/);
  });

  it("wires Partner Alumni list through the resolver", () => {
    const html = renderToStaticMarkup(
      <EventPartnerAlumniSection
        seriesName="Demo Series"
        partnerAlumni={{
          recognition_label: null,
          primary_source_url: null,
          source_checked_at: null,
          members: [
            {
              id: "m1",
              display_order: 1,
              company: {
                id: SFF_ID,
                slug: SFF_SLUG,
                name: "Singapore FinTech Festival",
                public_href: "/events/series/singapore-fintech-festival",
              },
            },
          ],
        }}
      />,
    );
    assert.match(html, /href="\/events\/series\/singapore-fintech-festival"/);
  });

  it("keeps restricted or unavailable Companies non-linkable", () => {
    const restrictedSponsor = renderToStaticMarkup(
      <ul>
        <PublicSponsorRosterRow
          sponsor={{
            id: "sponsor-r",
            company_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            companies: {
              id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              slug: "restricted-co",
              name: "Restricted Co",
              restricted_at: "2026-07-11T00:00:00.000Z",
              public_href: null,
            },
          }}
        />
      </ul>,
    );
    assert.doesNotMatch(restrictedSponsor, /<a\b/);

    const restrictedOrganizer = renderToStaticMarkup(
      <ul>
        <EventOrganizerListItem
          organizer={{
            id: "org-r",
            role_label: "Organizer",
            display_order: 1,
            company: {
              id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              slug: "restricted-co",
              name: "Restricted Co",
              restricted_at: "2026-07-11T00:00:00.000Z",
              public_href: null,
            },
          }}
        />
      </ul>,
    );
    assert.doesNotMatch(restrictedOrganizer, /<a\b/);
  });

  it("maps edition sponsor search href via the destination index", () => {
    const item = mapPublicSponsorSearchItem(
      {
        id: "link-sff",
        company_id: SFF_ID,
        company: {
          id: SFF_ID,
          name: "Singapore FinTech Festival",
          slug: SFF_SLUG,
          restricted_at: null,
        },
      },
      sffIndex(),
    );
    assert.equal(item?.company.href, "/events/series/singapore-fintech-festival");
    assert.doesNotMatch(item!.company.href!, /\?/);
  });
});
