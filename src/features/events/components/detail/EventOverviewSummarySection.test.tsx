import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { EventOverviewSummarySection } from "@/src/features/events/components/detail/EventOverviewSummarySection";
import type { EventSponsorRow } from "@/src/features/events/components/detail/types";
import type { PublicOrganizerRow } from "@/src/features/events/server/mapPublicOrganizers";
import type { PublicVenueSummary } from "@/src/features/events/server/mapPublicVenue";

function venue(
  overrides: Partial<PublicVenueSummary> = {},
): PublicVenueSummary {
  return {
    id: "venue-1",
    name: "Rebel",
    slug: "rebel",
    website_url: null,
    address_text: null,
    logo_url: null,
    archived_at: null,
    ...overrides,
  };
}

function sponsor(
  id: string,
  name: string,
  options: {
    slug?: string;
    restricted?: boolean;
    logo_url?: string | null;
  } = {},
): EventSponsorRow {
  return {
    id,
    company_id: `co-${id}`,
    tier_rank: 1,
    companies: {
      id: `co-${id}`,
      name,
      slug: options.slug ?? name.toLowerCase().replace(/\s+/g, "-"),
      restricted_at: options.restricted ? "2026-01-01T00:00:00.000Z" : null,
      logo_url: options.logo_url ?? null,
      logo_source: options.logo_url ? "manual" : null,
      logo_status: options.logo_url ? "ok" : null,
    },
  };
}

function organizer(
  id: string,
  name: string,
  slug?: string,
): PublicOrganizerRow {
  return {
    id,
    role_label: "Host",
    display_order: 1,
    company: {
      id: `org-${id}`,
      name,
      slug: slug ?? name.toLowerCase().replace(/\s+/g, "-"),
      logo_url: null,
      logo_source: null,
      logo_status: null,
    },
  };
}

describe("EventOverviewSummarySection compact AI-readability overview", () => {
  it("links the venue name only to the Venue tab", () => {
    const html = renderToStaticMarkup(
      <EventOverviewSummarySection
        eventSlug="token2049-singapore-2025"
        lifecycleStatus="active"
        venue={venue()}
        hasVenueId
        sponsors={[]}
        totalSponsorCount={0}
      />,
    );

    assert.match(html, /href="\/events\/token2049-singapore-2025\?tab=venue"/);
    assert.match(html, />Rebel</);
    assert.doesNotMatch(html, /href="\/venues\//);
    assert.doesNotMatch(html, /Venue details/);
  });

  it("uses body-text colour by default and brand colour on hover/focus for venue", () => {
    const html = renderToStaticMarkup(
      <EventOverviewSummarySection
        eventSlug="token2049-singapore-2025"
        lifecycleStatus={null}
        venue={venue()}
        hasVenueId
        sponsors={[]}
        totalSponsorCount={0}
      />,
    );

    assert.match(html, /text-slate-900/);
    assert.match(html, /hover:text-brand-primary/);
    assert.match(html, /focus-visible:text-brand-primary/);
  });

  it("shows sponsor total above the logo preview and links the preview to Sponsors tab", () => {
    const html = renderToStaticMarkup(
      <EventOverviewSummarySection
        eventSlug="token2049-singapore-2025"
        lifecycleStatus={null}
        venue={null}
        hasVenueId={false}
        totalSponsorCount={376}
        sponsors={[
          sponsor("1", "OKX", { logo_url: "https://cdn.example/okx.png" }),
          sponsor("2", "Coinbase", {
            logo_url: "https://cdn.example/coinbase.png",
          }),
        ]}
      />,
    );

    const countIndex = html.indexOf("376 sponsors");
    const logoIndex = html.indexOf("OKX logo");
    assert.ok(countIndex >= 0, "expected sponsor total text");
    assert.ok(logoIndex >= 0, "expected sponsor logo alt");
    assert.ok(countIndex < logoIndex, "sponsor total should appear before logos");
    assert.match(
      html,
      /href="\/events\/token2049-singapore-2025\?tab=sponsors"/,
    );
    assert.doesNotMatch(html, /href="\/sponsors\//);
  });

  it("shows at most 5 sponsor logos and no numeric overflow badge", () => {
    const sponsors = Array.from({ length: 8 }, (_, i) =>
      sponsor(String(i + 1), `Sponsor ${i + 1}`, {
        logo_url: `https://cdn.example/s${i + 1}.png`,
      }),
    );
    const html = renderToStaticMarkup(
      <EventOverviewSummarySection
        eventSlug="token2049-singapore-2025"
        lifecycleStatus={null}
        venue={null}
        hasVenueId={false}
        totalSponsorCount={376}
        sponsors={sponsors}
      />,
    );

    const logoAlts = html.match(/alt="Sponsor \d+ logo"/g) ?? [];
    assert.equal(logoAlts.length, 5);
    assert.doesNotMatch(html, /\+\d+/);
    assert.doesNotMatch(html, />\+\d+</);
  });

  it("shows ellipsis only when more sponsors exist than visible logos", () => {
    const withMore = renderToStaticMarkup(
      <EventOverviewSummarySection
        eventSlug="token2049-singapore-2025"
        lifecycleStatus={null}
        venue={null}
        hasVenueId={false}
        totalSponsorCount={376}
        sponsors={[
          sponsor("1", "OKX", { logo_url: "https://cdn.example/okx.png" }),
          sponsor("2", "Coinbase", {
            logo_url: "https://cdn.example/coinbase.png",
          }),
        ]}
      />,
    );
    assert.match(withMore, /…/);

    const exact = renderToStaticMarkup(
      <EventOverviewSummarySection
        eventSlug="token2049-singapore-2025"
        lifecycleStatus={null}
        venue={null}
        hasVenueId={false}
        totalSponsorCount={2}
        sponsors={[
          sponsor("1", "OKX", { logo_url: "https://cdn.example/okx.png" }),
          sponsor("2", "Coinbase", {
            logo_url: "https://cdn.example/coinbase.png",
          }),
        ]}
      />,
    );
    assert.doesNotMatch(exact, /…/);
  });

  it("does not wrap individual sponsor logos in company-profile links", () => {
    const html = renderToStaticMarkup(
      <EventOverviewSummarySection
        eventSlug="token2049-singapore-2025"
        lifecycleStatus={null}
        venue={null}
        hasVenueId={false}
        totalSponsorCount={1}
        sponsors={[
          sponsor("1", "OKX", {
            slug: "okx",
            logo_url: "https://cdn.example/okx.png",
          }),
        ]}
      />,
    );

    assert.doesNotMatch(html, /href="\/sponsors\/okx"/);
    assert.match(html, /alt="OKX logo"/);
  });

  it("exposes company names for assistive readers on sponsor logos", () => {
    const withImages = renderToStaticMarkup(
      <EventOverviewSummarySection
        eventSlug="token2049-singapore-2025"
        lifecycleStatus={null}
        venue={null}
        hasVenueId={false}
        totalSponsorCount={2}
        sponsors={[
          sponsor("1", "OKX", { logo_url: "https://cdn.example/okx.png" }),
          sponsor("2", "Coinbase", {
            logo_url: "https://cdn.example/coinbase.png",
          }),
        ]}
      />,
    );

    assert.match(withImages, /alt="OKX logo"/);
    assert.match(withImages, /alt="Coinbase logo"/);
    assert.doesNotMatch(withImages, /alt=""/);

    const withMonogram = renderToStaticMarkup(
      <EventOverviewSummarySection
        eventSlug="token2049-singapore-2025"
        lifecycleStatus={null}
        venue={null}
        hasVenueId={false}
        totalSponsorCount={1}
        sponsors={[sponsor("1", "OKX")]}
      />,
    );
    assert.match(withMonogram, /sr-only[^>]*>OKX logo</);
  });

  it("links the Organizers row only to the Organizers tab", () => {
    const html = renderToStaticMarkup(
      <EventOverviewSummarySection
        eventSlug="token2049-singapore-2025"
        lifecycleStatus={null}
        venue={null}
        hasVenueId={false}
        sponsors={[]}
        totalSponsorCount={0}
        organizers={[organizer("a", "Untraceable")]}
      />,
    );

    assert.match(html, />Untraceable</);
    assert.match(
      html,
      /href="\/events\/token2049-singapore-2025\?tab=organizers"/,
    );
    assert.doesNotMatch(html, /href="\/sponsors\//);
    assert.doesNotMatch(html, /View organizers/);
  });

  it("omits the Organizers row when empty", () => {
    const html = renderToStaticMarkup(
      <EventOverviewSummarySection
        eventSlug="token2049-singapore-2025"
        lifecycleStatus={null}
        venue={null}
        hasVenueId={false}
        sponsors={[]}
        totalSponsorCount={0}
        organizers={[]}
      />,
    );

    assert.doesNotMatch(html, />Organizers</);
  });

  it("does not introduce an Exhibitors row", () => {
    const html = renderToStaticMarkup(
      <EventOverviewSummarySection
        eventSlug="token2049-singapore-2025"
        lifecycleStatus={null}
        venue={venue()}
        hasVenueId
        sponsors={[]}
        totalSponsorCount={0}
        organizers={[organizer("a", "Untraceable")]}
      />,
    );

    assert.doesNotMatch(html, />Exhibitors</);
    assert.doesNotMatch(html, /exhibitors/i);
    assert.doesNotMatch(html, /\?tab=exhibitors/);
  });
});

describe("EventOverviewSummarySection zero-sponsor messaging", () => {
  it("shows the virtual_covid editorial note when count is 0", () => {
    const html = renderToStaticMarkup(
      <EventOverviewSummarySection
        eventSlug="startmeuphk-festival-2020"
        lifecycleStatus={null}
        venue={null}
        hasVenueId={false}
        sponsors={[]}
        totalSponsorCount={0}
        sponsorNoteType="virtual_covid"
      />,
    );

    assert.match(html, /COVID-19 virtual event/i);
    assert.match(
      html,
      /The official website does not provide a sponsor list/i,
    );
    assert.doesNotMatch(html, /Sponsor data not yet available/i);
    assert.doesNotMatch(html, /No sponsors linked to this event yet/i);
    assert.doesNotMatch(html, /\?tab=sponsors/);
  });

  it("shows the upcoming_pending editorial note when count is 0", () => {
    const html = renderToStaticMarkup(
      <EventOverviewSummarySection
        eventSlug="ethdenver-2027"
        lifecycleStatus={null}
        venue={null}
        hasVenueId={false}
        sponsors={[]}
        totalSponsorCount={0}
        sponsorNoteType="upcoming_pending"
      />,
    );

    assert.match(html, /Sponsor list is expected to be finalized after the event concludes/i);
    assert.doesNotMatch(html, /Sponsor data not yet available/i);
    assert.doesNotMatch(html, /No sponsors linked to this event yet/i);
    assert.doesNotMatch(html, /\?tab=sponsors/);
  });

  it("shows the empty-roster message when count is 0 and no sponsor note", () => {
    const html = renderToStaticMarkup(
      <EventOverviewSummarySection
        eventSlug="token2049-singapore-2026"
        lifecycleStatus={null}
        venue={null}
        hasVenueId={false}
        sponsors={[]}
        totalSponsorCount={0}
        sponsorNoteType={null}
      />,
    );

    assert.match(html, /No sponsors linked to this event yet/i);
    assert.doesNotMatch(html, /Sponsor data not yet available/i);
    assert.doesNotMatch(html, /COVID-19 virtual event/i);
  });
});
