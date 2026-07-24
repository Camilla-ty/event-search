import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { VenueHubHeader } from "@/src/features/venues/components/VenueHubHeader";

const baseVenue = {
  id: "8ee9dbd6-e8f6-42b7-94f5-66829e6ce8a5",
  name: "The Venetian Resort Las Vegas",
  slug: "the-venetian-resort-las-vegas",
  website_url: "https://www.venetianlasvegas.com",
  address_text: "3355 S Las Vegas Blvd, Las Vegas, NV 89109, United States",
  logo_url: "https://example.com/logo.png",
  locationLabel: "Las Vegas, Nevada",
};

describe("VenueHubHeader", () => {
  it("renders city overline, summary, linked address, and domain website", () => {
    const html = renderToStaticMarkup(
      <VenueHubHeader
        venue={baseVenue}
        factualSummary="The Venetian Resort Las Vegas is a venue in Las Vegas, Nevada on EventPixels."
      />,
    );

    assert.match(html, /Las Vegas, Nevada/);
    assert.match(html, /<h1[^>]*>The Venetian Resort Las Vegas<\/h1>/);
    assert.match(html, /is a venue in Las Vegas, Nevada on EventPixels/);
    assert.match(html, /3355 S Las Vegas Blvd/);
    assert.match(html, />venetianlasvegas\.com</);
    assert.doesNotMatch(html, />Website</);
    assert.doesNotMatch(html, />Map</);
    assert.match(html, /href="https:\/\/www\.venetianlasvegas\.com/);
    assert.match(html, /href="https:\/\/www\.google\.com\/maps\/search/);

    const cityIdx = html.indexOf("Las Vegas, Nevada");
    const h1Idx = html.indexOf("<h1");
    const summaryIdx = html.indexOf("is a venue in Las Vegas");
    assert.ok(cityIdx >= 0 && h1Idx > cityIdx);
    assert.ok(summaryIdx > h1Idx);
  });

  it("omits website and address when unavailable", () => {
    const html = renderToStaticMarkup(
      <VenueHubHeader
        venue={{
          ...baseVenue,
          website_url: null,
          address_text: null,
        }}
      />,
    );

    assert.doesNotMatch(html, /venetianlasvegas/);
    assert.doesNotMatch(html, />Map</);
    assert.doesNotMatch(html, /google\.com\/maps/);
    assert.match(html, /browse events held here below/);
    assert.match(html, /Las Vegas, Nevada/);
  });
});
