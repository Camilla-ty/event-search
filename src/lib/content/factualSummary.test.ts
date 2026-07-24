import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCompanySummary,
  buildEventEditionSummary,
  buildEventSeriesSummary,
  buildVenueSummary,
  countDistinctSponsorshipTiers,
  formatSummaryDateRange,
  resolveEventEditionTense,
} from "@/src/lib/content/factualSummary";

const NOW = new Date("2026-07-17T12:00:00.000Z");

const BANNED = [
  "largest",
  "leading",
  "premier",
  "top",
  "best",
  "world-class",
  "renowned",
  "join",
  "register",
  "don't miss",
  "sign up",
  "book now",
  "official",
  "annual",
  "TBD",
  "unknown",
  "coming soon",
  "no sponsors yet",
] as const;

function assertNoBannedWording(text: string) {
  const lower = text.toLowerCase();
  for (const phrase of BANNED) {
    const escaped = phrase.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, "i");
    assert.equal(
      pattern.test(lower),
      false,
      `banned wording found: ${phrase} in ${text}`,
    );
  }
}

function assertNoLegacyTerminology(text: string) {
  assert.doesNotMatch(text, /\bevent (?:series|editions?)\b/i);
}

describe("formatSummaryDateRange", () => {
  it("uses the canonical public event date range", () => {
    assert.equal(
      formatSummaryDateRange("2026-09-16", "2026-09-17"),
      "Sep 16 – Sep 17, 2026",
    );
  });

  it("formats a single day", () => {
    assert.equal(formatSummaryDateRange("2026-07-02", null), "Jul 2, 2026");
  });
});

describe("resolveEventEditionTense", () => {
  it("classifies past, current, future, and tenseless boundaries", () => {
    assert.equal(
      resolveEventEditionTense({
        startDate: "2026-06-11",
        endDate: "2026-06-13",
        now: NOW,
      }),
      "past",
    );
    assert.equal(
      resolveEventEditionTense({
        startDate: "2026-07-16",
        endDate: "2026-07-18",
        now: NOW,
      }),
      "current",
    );
    assert.equal(
      resolveEventEditionTense({
        startDate: "2026-09-16",
        endDate: "2026-09-17",
        now: NOW,
      }),
      "future",
    );
    assert.equal(
      resolveEventEditionTense({ startDate: null, endDate: null, now: NOW }),
      "tenseless",
    );
    assert.equal(
      resolveEventEditionTense({
        startDate: "2026-07-17",
        endDate: "2026-07-17",
        now: NOW,
      }),
      "current",
    );
    assert.equal(
      resolveEventEditionTense({
        startDate: "2026-07-16",
        endDate: "2026-07-16",
        now: NOW,
      }),
      "past",
    );
    assert.equal(
      resolveEventEditionTense({
        startDate: "2026-07-18",
        endDate: "2026-07-18",
        now: NOW,
      }),
      "future",
    );
  });
});

describe("countDistinctSponsorshipTiers", () => {
  it("counts distinct ranks and ignores untiered links", () => {
    assert.equal(
      countDistinctSponsorshipTiers([
        { tier_rank: 1, tier_label: "Title" },
        { tier_rank: 1, tier_label: "Title" },
        { tier_rank: 2, tier_label: "Gold" },
        { tier_rank: null, tier_label: null },
      ]),
      2,
    );
  });
});

describe("buildEventEditionSummary", () => {
  it("builds a future edition summary with sponsors, tiers, and last reviewed", () => {
    const summary = buildEventEditionSummary({
      name: "Avalanche Summit New York 2026",
      seriesName: "Avalanche Summit",
      startDate: "2026-09-16",
      endDate: "2026-09-17",
      locationLabel: "New York, United States",
      sponsorCount: 34,
      sponsorshipTierCount: 4,
      lastReviewedAt: "2026-07-02T00:00:00.000Z",
      now: NOW,
    });

    assert.equal(
      summary,
      "Avalanche Summit New York 2026 is an event from the Avalanche Summit event brand. It will take place on Sep 16 – Sep 17, 2026 in New York, United States. 34 sponsors are recorded for this event across 4 sponsorship tiers on EventPixels. Sponsor information was last reviewed on July 2, 2026.",
    );
    assertNoBannedWording(summary!);
    assertNoLegacyTerminology(summary!);
  });

  it("builds a future edition without tiers or last reviewed", () => {
    const summary = buildEventEditionSummary({
      name: "Devcon 8",
      seriesName: "Devcon",
      startDate: "2026-11-03",
      endDate: "2026-11-06",
      locationLabel: "Mumbai, India",
      sponsorCount: 12,
      now: NOW,
    });

    assert.equal(
      summary,
      "Devcon 8 is an event from the Devcon event brand. It will take place on Nov 3 – Nov 6, 2026 in Mumbai, India. 12 sponsors are recorded for this event on EventPixels.",
    );
  });

  it("builds a currently running edition summary", () => {
    const summary = buildEventEditionSummary({
      name: "ETHGlobal Lisbon 2026",
      seriesName: "ETHGlobal",
      startDate: "2026-07-16",
      endDate: "2026-07-18",
      locationLabel: "Lisbon, Portugal",
      sponsorCount: 21,
      sponsorshipTierCount: 3,
      lastReviewedAt: "2026-07-14",
      now: NOW,
    });

    assert.equal(
      summary,
      "ETHGlobal Lisbon 2026 is an event from the ETHGlobal event brand. It is taking place Jul 16 – Jul 18, 2026 in Lisbon, Portugal. 21 sponsors are recorded for this event across 3 sponsorship tiers on EventPixels. Sponsor information was last reviewed on July 14, 2026.",
    );
  });

  it("builds a past edition summary with venue", () => {
    const summary = buildEventEditionSummary({
      name: "BTC Prague 2026",
      seriesName: "BTC Prague",
      startDate: "2026-06-11",
      endDate: "2026-06-13",
      locationLabel: "Prague, Czech Republic",
      venueName: "PVA EXPO Praha",
      sponsorCount: 81,
      sponsorshipTierCount: 6,
      lastReviewedAt: "2026-06-20",
      now: NOW,
    });

    assert.equal(
      summary,
      "BTC Prague 2026 is an event from the BTC Prague event brand. It took place on Jun 11 – Jun 13, 2026 in Prague, Czech Republic. The venue was PVA EXPO Praha. 81 sponsors are recorded for this event across 6 sponsorship tiers on EventPixels. Sponsor information was last reviewed on June 20, 2026.",
    );
  });

  it("omits zero sponsors and missing fields for a sparse edition", () => {
    const summary = buildEventEditionSummary({
      name: "WebSummit Rio 2027",
      seriesName: "Web Summit",
      locationLabel: "Rio de Janeiro, Brazil",
      sponsorCount: 0,
      now: NOW,
    });

    assert.equal(
      summary,
      "WebSummit Rio 2027 is an event from the Web Summit event brand. It is held in Rio de Janeiro, Brazil.",
    );
    assert.doesNotMatch(summary!, /sponsor/i);
    assert.doesNotMatch(summary!, /TBD|unknown|0 sponsor/i);
  });

  it("renders a minimal name-only edition", () => {
    const summary = buildEventEditionSummary({
      name: "Example Conference 2027",
      now: NOW,
    });
    assert.equal(
      summary,
      "Example Conference 2027 is an event on EventPixels.",
    );
  });

  it("returns null when name is missing", () => {
    assert.equal(buildEventEditionSummary({ name: "  " }), null);
  });

  it("pluralizes a single sponsor and single tier", () => {
    const summary = buildEventEditionSummary({
      name: "Solo Event",
      sponsorCount: 1,
      sponsorshipTierCount: 1,
      now: NOW,
    });
    assert.match(summary!, /1 sponsor is recorded/);
    assert.match(summary!, /across 1 sponsorship tier on EventPixels/);
  });
});

describe("buildEventSeriesSummary", () => {
  it("builds an active series with an upcoming edition and topics", () => {
    const summary = buildEventSeriesSummary({
      name: "Bitcoin Conference",
      lifecycleStatus: "active",
      editions: [
        {
          name: "Bitcoin Conference 2024",
          year: 2024,
          startDate: "2024-07-25",
          endDate: "2024-07-27",
          locationLabel: "Nashville, United States",
        },
        {
          name: "Bitcoin Las Vegas 2025",
          year: 2025,
          startDate: "2025-05-27",
          endDate: "2025-05-29",
          locationLabel: "Las Vegas, United States",
        },
        {
          name: "Bitcoin Las Vegas 2026",
          year: 2026,
          startDate: "2026-04-27",
          endDate: "2026-04-29",
          locationLabel: "Las Vegas, United States",
        },
        {
          name: "Bitcoin Hong Kong 2027",
          year: 2027,
          startDate: "2027-01-12",
          endDate: "2027-01-14",
          locationLabel: "Hong Kong",
        },
      ],
      topics: ["Bitcoin", "Payments"],
      now: NOW,
    });

    assert.equal(
      summary,
      "Bitcoin Conference is an event brand on EventPixels. 4 events are recorded, from 2024 to 2027. The next recorded event, Bitcoin Hong Kong 2027, will take place on Jan 12 – Jan 14, 2027 in Hong Kong. The event brand is associated with the topics Bitcoin and Payments.",
    );
    assertNoBannedWording(summary!);
    assertNoLegacyTerminology(summary!);
  });

  it("uses the most recent past edition when none are upcoming", () => {
    const summary = buildEventSeriesSummary({
      name: "StartmeupHK Festival",
      editions: [
        { name: "StartmeupHK Festival 2019", year: 2019, locationLabel: "Hong Kong" },
        { name: "StartmeupHK Festival 2024", year: 2024, locationLabel: "Hong Kong" },
        { name: "StartmeupHK Festival 2020", year: 2020, locationLabel: "Hong Kong" },
        { name: "StartmeupHK Festival 2021", year: 2021, locationLabel: "Hong Kong" },
        { name: "StartmeupHK Festival 2022", year: 2022, locationLabel: "Hong Kong" },
        { name: "StartmeupHK Festival 2023", year: 2023, locationLabel: "Hong Kong" },
      ],
      now: NOW,
    });

    assert.equal(
      summary,
      "StartmeupHK Festival is an event brand on EventPixels. 6 events are recorded, from 2019 to 2024. The most recent recorded event, StartmeupHK Festival 2024, took place in 2024 in Hong Kong.",
    );
  });

  it("marks discontinued series and omits topics when empty", () => {
    const summary = buildEventSeriesSummary({
      name: "Token Forum",
      lifecycleStatus: "discontinued",
      editions: [
        { name: "Token Forum 2021", year: 2021 },
        { name: "Token Forum 2022", year: 2022 },
        {
          name: "Token Forum 2023",
          year: 2023,
          locationLabel: "Singapore",
        },
      ],
      now: NOW,
    });

    assert.equal(
      summary,
      "Token Forum is an event brand marked as discontinued on EventPixels. 3 events are recorded, from 2021 to 2023. The most recent recorded event, Token Forum 2023, took place in 2023 in Singapore.",
    );
  });

  it("handles a single-edition series", () => {
    const summary = buildEventSeriesSummary({
      name: "Nordic Fintech Week",
      editions: [{ name: "Nordic Fintech Week 2026", year: 2026 }],
      now: NOW,
    });
    assert.equal(
      summary,
      "Nordic Fintech Week is an event brand on EventPixels. 1 event is recorded, in 2026.",
    );
  });

  it("returns null for merged series", () => {
    assert.equal(
      buildEventSeriesSummary({
        name: "Old Brand",
        lifecycleStatus: "merged",
        editions: [{ name: "Old Brand 2024", year: 2024 }],
      }),
      null,
    );
  });
});

describe("buildCompanySummary", () => {
  it("includes website, count, and access note for indexable companies", () => {
    const summary = buildCompanySummary({
      name: "BitGo",
      domain: "bitgo.com",
      sponsoredEditionCount: 23,
    });
    assert.equal(
      summary,
      "BitGo is a company profiled on EventPixels; its website is bitgo.com. It has sponsored 23 events recorded on EventPixels. The full list of sponsored events is available to logged-in users.",
    );
    assert.doesNotMatch(summary!, /BTC Prague|Consensus|Bitcoin Conference/i);
    assertNoBannedWording(summary!);
  });

  it("singularizes a single sponsorship without a website", () => {
    const summary = buildCompanySummary({
      name: "Nexus Analytics",
      sponsoredEditionCount: 1,
    });
    assert.equal(
      summary,
      "Nexus Analytics is a company profiled on EventPixels. It has sponsored 1 event recorded on EventPixels. The full list of sponsored events is available to logged-in users.",
    );
  });

  it("omits count sentences for zero-sponsor companies", () => {
    const summary = buildCompanySummary({
      name: "Acme Robotics",
      domain: "acmerobotics.com",
      sponsoredEditionCount: 0,
    });
    assert.equal(
      summary,
      "Acme Robotics is a company profiled on EventPixels; its website is acmerobotics.com.",
    );
    assert.doesNotMatch(summary!, /sponsored|logged-in/i);
  });

  it("omits count sentences when stats are unknown", () => {
    const summary = buildCompanySummary({
      name: "BitGo",
      domain: "bitgo.com",
      sponsoredEditionCount: 0,
      sponsoredEditionCountUnknown: true,
    });
    assert.equal(
      summary,
      "BitGo is a company profiled on EventPixels; its website is bitgo.com.",
    );
  });

  it("never includes gated event names even if they appear in the company name only", () => {
    const summary = buildCompanySummary({
      name: "Fireblocks",
      website: "https://www.fireblocks.com",
      sponsoredEditionCount: 40,
    });
    assert.match(summary!, /its website is fireblocks\.com/);
    assert.doesNotMatch(summary!, /took place|event from the/i);
  });
});

describe("buildVenueSummary", () => {
  it("builds a venue with location, count, and next upcoming event", () => {
    const summary = buildVenueSummary({
      name: "The Venetian Resort Las Vegas",
      locationLabel: "Las Vegas, Nevada",
      editions: [
        {
          name: "Bitcoin Las Vegas 2025",
          year: 2025,
          startDate: "2025-05-27",
          endDate: "2025-05-29",
          locationLabel: "Las Vegas, Nevada",
        },
        {
          name: "Bitcoin Las Vegas 2026",
          year: 2026,
          startDate: "2026-09-27",
          endDate: "2026-09-29",
          locationLabel: "Las Vegas, Nevada",
        },
      ],
      now: NOW,
    });

    assert.equal(
      summary,
      "The Venetian Resort Las Vegas is a venue in Las Vegas, Nevada on EventPixels. 2 events are recorded at this venue. The next recorded event, Bitcoin Las Vegas 2026, will take place on Sep 27 – Sep 29, 2026.",
    );
    assertNoBannedWording(summary!);
  });

  it("uses most recent past when no upcoming editions exist", () => {
    const summary = buildVenueSummary({
      name: "Marina Bay Sands",
      locationLabel: "Singapore",
      editions: [
        {
          name: "Token2049 Singapore 2024",
          year: 2024,
          startDate: "2024-09-18",
          endDate: "2024-09-19",
        },
      ],
      now: NOW,
    });

    assert.equal(
      summary,
      "Marina Bay Sands is a venue in Singapore on EventPixels. 1 event is recorded at this venue. The most recent recorded event, Token2049 Singapore 2024, took place in 2024.",
    );
  });

  it("omits event sentences when no editions are provided", () => {
    const summary = buildVenueSummary({
      name: "Epicenter Stockholm",
      locationLabel: "Stockholm, Sweden",
      editions: [],
      now: NOW,
    });

    assert.equal(
      summary,
      "Epicenter Stockholm is a venue in Stockholm, Sweden on EventPixels.",
    );
  });

  it("returns null for an empty name", () => {
    assert.equal(buildVenueSummary({ name: "  " }), null);
  });
});

describe("banned wording corpus", () => {
  it("keeps representative outputs free of marketing and absence apologies", () => {
    const corpus = [
      buildEventEditionSummary({
        name: "Avalanche Summit New York 2026",
        seriesName: "Avalanche Summit",
        startDate: "2026-09-16",
        endDate: "2026-09-17",
        locationLabel: "New York, United States",
        sponsorCount: 34,
        sponsorshipTierCount: 4,
        lastReviewedAt: "2026-07-02",
        now: NOW,
      }),
      buildEventEditionSummary({
        name: "Sparse Event",
        locationLabel: "Berlin, Germany",
        sponsorCount: 0,
        now: NOW,
      }),
      buildEventSeriesSummary({
        name: "Bitcoin Conference",
        editions: [
          {
            name: "Bitcoin Hong Kong 2027",
            year: 2027,
            startDate: "2027-01-12",
            endDate: "2027-01-14",
            locationLabel: "Hong Kong",
          },
        ],
        topics: ["Bitcoin"],
        now: NOW,
      }),
      buildCompanySummary({
        name: "BitGo",
        domain: "bitgo.com",
        sponsoredEditionCount: 23,
      }),
      buildVenueSummary({
        name: "The Venetian Resort Las Vegas",
        locationLabel: "Las Vegas, Nevada",
        editions: [
          {
            name: "Bitcoin Las Vegas 2026",
            year: 2026,
            startDate: "2026-09-27",
            endDate: "2026-09-29",
          },
        ],
        now: NOW,
      }),
    ];

    for (const text of corpus) {
      assert.ok(text);
      assertNoBannedWording(text);
      assertNoLegacyTerminology(text);
    }
  });
});
