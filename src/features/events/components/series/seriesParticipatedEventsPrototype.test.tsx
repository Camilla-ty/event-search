import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  buildSeriesHubTabHref,
  parseSeriesHubTab,
  SeriesHubBody,
} from "@/src/features/events/components/series/SeriesHubBody";
import { SeriesHubHeader } from "@/src/features/events/components/series/SeriesHubHeader";
import { SeriesParticipatedEventsList } from "@/src/features/events/components/series/SeriesParticipatedEventsList";
import { SponsorDetailView } from "@/src/features/sponsors/components/detail/SponsorDetailView";
import type { SponsorDetailData } from "@/src/features/sponsors/server/types";
import {
  formatParticipatedRoleLabel,
  mapSeriesParticipatedSponsorRow,
  sortSeriesParticipatedEvents,
} from "@/src/features/events/server/seriesParticipatedEvents";
import type { PublicEventSeriesSummary } from "@/src/features/events/types/publicEdition";
import type { SeriesParticipatedEvent } from "@/src/features/events/types/seriesParticipatedEvents";
import { buildPublicSameBrandSeriesLink } from "@/src/lib/companies/sameBrandPublicLink";
import {
  fileTabActiveClass,
  fileTabBarClass,
  fileTabInactiveClass,
  fileTabLinkClass,
  fileTabPanelClass,
  fileTabScrollRowClass,
  fileTabShellClass,
  navItemActiveClass,
  navItemInactiveClass,
} from "@/src/lib/design/classes";

const SERIES = {
  id: "78232c5b-7ef2-4cda-a23a-941387e1a9c1",
  slug: "singapore-fintech-festival",
};

function editionEmbed(overrides: Record<string, unknown> = {}) {
  return {
    id: "d867e77b-5751-4305-9364-04efa5bb1c11",
    slug: "digital-assets-week-singapore-2024",
    name: "Digital Assets Week Singapore 2024",
    year: 2024,
    start_date: "2024-11-04",
    end_date: "2024-11-05",
    event_series: {
      id: "43c8b961-b167-43a6-b6a6-41d8dbd68b2a",
      name: "Digital Assets Week",
      slug: "digital-assets-week",
      website_url: null,
      logo_url: null,
      lifecycle_status: "active",
      merged_into_series: null,
    },
    cities: {
      name: "Singapore",
      states: null,
      countries: { name: "Singapore" },
    },
    ...overrides,
  };
}

const SFF_ITEMS: SeriesParticipatedEvent[] = [
  {
    edition: {
      id: "d867e77b-5751-4305-9364-04efa5bb1c11",
      slug: "digital-assets-week-singapore-2024",
      name: "Digital Assets Week Singapore 2024",
      year: 2024,
      start_date: "2024-11-04",
      end_date: "2024-11-05",
      locationLabel: "Singapore, Singapore",
      event_series: { name: "Digital Assets Week", logo_url: null },
    },
    roleLabel: "Premier Event Partner",
    tierRank: 5,
    tierLabel: "Premier Event Partner",
  },
  {
    edition: {
      id: "fe7f4704-712d-475e-9237-5660540a46ad",
      slug: "nordic-blockchain-conference-2023",
      name: "Nordic Blockchain Conference 2023",
      year: 2023,
      start_date: "2023-09-06",
      end_date: "2023-09-07",
      locationLabel: "Copenhagen, Denmark",
      event_series: { name: "Nordic Blockchain Conference", logo_url: null },
    },
    roleLabel: "Community and Media Partner",
    tierRank: 4,
    tierLabel: "Community and Media Partner",
  },
];

const HUB_SERIES: PublicEventSeriesSummary = {
  id: SERIES.id,
  slug: SERIES.slug,
  name: "Singapore Fintech Festival",
  website_url: "https://www.fintechfestival.sg/",
  logo_url: null,
  lifecycle_status: "active",
  merged_into_series: null,
};

describe("Series Participated Events refined prototype", () => {
  it("shows the Participated Events tab only when results exist", () => {
    const withResults = renderToStaticMarkup(
      <SeriesHubBody
        series={SERIES}
        editions={[]}
        participatedEvents={SFF_ITEMS}
        activeTab="events"
      />,
    );
    assert.match(withResults, /Participated Events/);
    assert.match(withResults, /\?tab=participated/);
    assert.match(withResults, /role="tablist"/);
    assert.ok(withResults.includes(fileTabShellClass));
    assert.ok(withResults.includes(fileTabBarClass));
    assert.ok(withResults.includes(fileTabScrollRowClass));
    assert.ok(withResults.includes(fileTabPanelClass));
    assert.ok(withResults.includes(fileTabLinkClass(true)));
    assert.ok(withResults.includes(fileTabLinkClass(false)));
    assert.ok(!withResults.includes(navItemActiveClass));
    assert.ok(!withResults.includes(navItemInactiveClass));

    const empty = renderToStaticMarkup(
      <SeriesHubBody
        series={SERIES}
        editions={[]}
        participatedEvents={[]}
        activeTab="events"
      />,
    );
    assert.doesNotMatch(empty, /Participated Events/);
    assert.doesNotMatch(empty, /\?tab=participated/);
    assert.doesNotMatch(empty, /role="tablist"/);
    assert.ok(!empty.includes(fileTabShellClass));
  });

  it("applies fileTab active/inactive classes and keeps server Link hrefs", () => {
    const eventsTab = renderToStaticMarkup(
      <SeriesHubBody
        series={SERIES}
        editions={[]}
        participatedEvents={SFF_ITEMS}
        activeTab="events"
      />,
    );
    assert.match(
      eventsTab,
      /href="\/events\/series\/singapore-fintech-festival"/,
    );
    assert.match(
      eventsTab,
      /href="\/events\/series\/singapore-fintech-festival\?tab=participated"/,
    );
    assert.match(
      eventsTab,
      /aria-current="page"[^>]*aria-selected="true"[^>]*>Events</,
    );
    assert.match(
      eventsTab,
      /aria-selected="false"[^>]*>Participated Events</,
    );
    assert.ok(eventsTab.includes(fileTabActiveClass));
    assert.ok(eventsTab.includes(fileTabInactiveClass));

    const participatedTab = renderToStaticMarkup(
      <SeriesHubBody
        series={SERIES}
        editions={[]}
        participatedEvents={SFF_ITEMS}
        activeTab="participated"
      />,
    );
    assert.match(
      participatedTab,
      /aria-current="page"[^>]*aria-selected="true"[^>]*>Participated Events</,
    );
    assert.match(participatedTab, /aria-selected="false"[^>]*>Events</);
    assert.match(participatedTab, /Premier Event Partner/);
    assert.match(participatedTab, /Community and Media Partner/);
  });


  it("sorts newest first", () => {
    const sorted = sortSeriesParticipatedEvents([SFF_ITEMS[1]!, SFF_ITEMS[0]!]);
    assert.equal(sorted[0]?.edition.name, "Digital Assets Week Singapore 2024");
    assert.equal(sorted[1]?.edition.name, "Nordic Blockchain Conference 2023");

    const html = renderToStaticMarkup(
      <SeriesParticipatedEventsList items={sorted} />,
    );
    const newer = html.indexOf("Digital Assets Week Singapore 2024");
    const older = html.indexOf("Nordic Blockchain Conference 2023");
    assert.ok(newer >= 0 && older >= 0);
    assert.ok(newer < older);
  });

  it("renders title, year, city, dates, and secondary role for SFF fixtures", () => {
    const html = renderToStaticMarkup(
      <SeriesParticipatedEventsList items={SFF_ITEMS} />,
    );

    assert.match(html, /Digital Assets Week Singapore 2024/);
    assert.match(html, /Nordic Blockchain Conference 2023/);
    assert.match(html, /2024/);
    assert.match(html, /2023/);
    assert.match(html, /Singapore/);
    assert.match(html, /Copenhagen/);
    assert.match(html, /Premier Event Partner/);
    assert.match(html, /Community and Media Partner/);
    assert.match(html, /Sponsor role/);
    assert.doesNotMatch(html, />Role:/);
  });

  it("makes the entire row navigate to the Event Edition", () => {
    const html = renderToStaticMarkup(
      <SeriesParticipatedEventsList items={SFF_ITEMS} />,
    );

    assert.match(
      html,
      /href="\/events\/digital-assets-week-singapore-2024"[^>]*>[\s\S]*Digital Assets Week Singapore 2024/,
    );
    assert.match(
      html,
      /aria-label="View Digital Assets Week Singapore 2024 \(Premier Event Partner\)"/,
    );
    assert.doesNotMatch(html, /View event/);
  });

  it("excludes merged and unavailable edition targets", () => {
    assert.equal(
      mapSeriesParticipatedSponsorRow({
        tier_rank: 1,
        tier_label: "Gold",
        event_editions: editionEmbed({
          event_series: {
            id: "merged-series",
            name: "Gone Brand",
            slug: "gone-brand",
            lifecycle_status: "merged",
            merged_into_series: null,
          },
        }),
      }),
      null,
    );
    assert.equal(
      mapSeriesParticipatedSponsorRow({
        tier_rank: 1,
        tier_label: "Gold",
        event_editions: editionEmbed({ slug: "" }),
      }),
      null,
    );

    const ok = mapSeriesParticipatedSponsorRow({
      tier_rank: 5,
      tier_label: "Premier Event Partner",
      event_editions: editionEmbed(),
    });
    assert.ok(ok);
    assert.equal(ok.roleLabel, "Premier Event Partner");
    assert.match(ok.edition.locationLabel, /Singapore/);
  });

  it("keeps reciprocal Company/Event profile chrome hidden", () => {
    const seriesHtml = renderToStaticMarkup(
      <SeriesHubHeader series={HUB_SERIES} />,
    );
    assert.doesNotMatch(seriesHtml, /Company profile/);
    assert.doesNotMatch(seriesHtml, /\/sponsors\//);

    const link = buildPublicSameBrandSeriesLink({
      id: SERIES.id,
      slug: SERIES.slug,
      name: "Singapore Fintech Festival",
      lifecycle_status: "active",
    });
    assert.ok(link);

    const companyData: SponsorDetailData = {
      company: {
        id: "f85bff6d-f25a-40c5-839f-4a395fbb3d37",
        name: "Singapore FinTech Festival",
        slug: "singapore-fintech-festival",
        domain: "fintechfestival.sg",
        website: "https://www.fintechfestival.sg/",
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
      summary: { sponsoredEditionCount: 2 },
      eventSeriesGroups: [],
      sameBrandSeriesLink: link,
    };
    const companyHtml = renderToStaticMarkup(
      <SponsorDetailView data={companyData} />,
    );
    assert.doesNotMatch(companyHtml, /Event profile/);
    assert.doesNotMatch(companyHtml, /\/events\/series\//);
  });

  it("formats roles and parses hub tabs", () => {
    assert.equal(
      formatParticipatedRoleLabel(4, "Community and Media Partner"),
      "Community and Media Partner",
    );
    assert.equal(formatParticipatedRoleLabel(3, null), "Tier 3");
    assert.equal(parseSeriesHubTab("participated", true), "participated");
    assert.equal(parseSeriesHubTab("participated", false), "events");
    assert.equal(parseSeriesHubTab(undefined, true), "events");
    assert.equal(parseSeriesHubTab("overview", true), "events");
    assert.equal(
      buildSeriesHubTabHref(SERIES, "events"),
      "/events/series/singapore-fintech-festival",
    );
    assert.equal(
      buildSeriesHubTabHref(SERIES, "participated"),
      "/events/series/singapore-fintech-festival?tab=participated",
    );
  });
});

