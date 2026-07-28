import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { DiscoverCalendarUpcomingSection } from "@/src/features/home/components/DiscoverCalendarUpcomingSection";
import type { DiscoverEditionSummary } from "@/src/features/home/server/getDiscoverHomeData";

function edition(overrides: Partial<DiscoverEditionSummary> = {}): DiscoverEditionSummary {
  return {
    id: "evt-1",
    slug: "bitcoin-las-vegas-2026",
    name: "Bitcoin Las Vegas 2026",
    year: 2026,
    start_date: "2026-04-27",
    end_date: "2026-04-29",
    locationLabel: "Las Vegas, Nevada",
    event_series: {
      name: "Bitcoin Conference",
      logo_url: null,
    },
    topicPreview: {
      visibleKeywords: [{ key: "kw-1", label: "Bitcoin" }],
      overflowCount: 0,
    },
    ...overrides,
  };
}

describe("DiscoverCalendarUpcomingSection", () => {
  it("moves View all into the compact list footer without a header duplicate", () => {
    const html = renderToStaticMarkup(
      <DiscoverCalendarUpcomingSection
        calendarEvents={[]}
        upcoming={[
          edition(),
          edition({
            id: "evt-2",
            slug: "bitcoin-asia-2026",
            name: "Bitcoin Asia 2026",
          }),
        ]}
        upcomingViewAllHref="/events?start=2026-07-28"
      />,
    );

    assert.match(html, /grid grid-cols-1 gap-8 border-b border-slate-200 pb-12 lg:grid-cols-12/);
    assert.match(html, /Upcoming Events/);
    assert.match(html, /Browse all upcoming events/);
    assert.match(html, /href="\/events\?start=2026-07-28"/);
    assert.match(
      html,
      /mt-auto block rounded-b-xl border-t border-slate-200 bg-white px-4 py-3/,
    );
    assert.match(html, /text-center text-sm text-slate-600/);
    assert.match(html, /hover:bg-slate-50 hover:text-brand-primary/);
    assert.equal(html.includes(">View all<"), false);
    assert.equal(html.match(/<li/g)?.length, 2);
    assert.match(html, /Bitcoin Las Vegas 2026/);
    assert.match(html, /Bitcoin Asia 2026/);
  });
});
