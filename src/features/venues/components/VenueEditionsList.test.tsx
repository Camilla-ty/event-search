import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { VenueEditionsList } from "@/src/features/venues/components/VenueEditionsList";
import type { PublicEditionSummary } from "@/src/features/events/types/publicEdition";

const edition: PublicEditionSummary = {
  id: "ed-1",
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
};

describe("VenueEditionsList", () => {
  it("renders titled event rows with series name and view link", () => {
    const html = renderToStaticMarkup(
      <VenueEditionsList title="Upcoming" editions={[edition]} />,
    );

    assert.match(html, /<h2[^>]*>Upcoming<\/h2>/);
    assert.match(html, /Bitcoin Las Vegas 2026/);
    assert.match(html, /Bitcoin Conference/);
    assert.match(html, /View event/);
    assert.match(html, /href="\/events\/bitcoin-las-vegas-2026"/);
  });

  it("renders venue-specific empty copy", () => {
    const html = renderToStaticMarkup(
      <VenueEditionsList title="Events at this venue" editions={[]} />,
    );

    assert.match(html, /No public events are listed for this venue yet/);
    assert.doesNotMatch(html, /<h2/);
  });
});
