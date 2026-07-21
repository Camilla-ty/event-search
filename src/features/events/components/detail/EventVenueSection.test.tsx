import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  EventVenueEmptyState,
  EventVenueSection,
} from "@/src/features/events/components/detail/EventVenueSection";

const baseVenue = {
  id: "8ee9dbd6-e8f6-42b7-94f5-66829e6ce8a5",
  name: "Marina Bay Sands Expo & Convention Centre",
  website_url: "https://example.com",
  address_text: "10 Bayfront Avenue\nSingapore 018956",
  logo_url: "https://example.com/logo.png",
  archived_at: null,
};

describe("EventVenueSection", () => {
  it("renders premium venue card with logo, actions, and address", () => {
    const html = renderToStaticMarkup(
      <EventVenueSection venue={baseVenue} cityLabel="Singapore" embedded />,
    );

    assert.match(html, /<h2[^>]*>Venue<\/h2>/);
    assert.match(html, /Marina Bay Sands Expo &amp; Convention Centre/);
    assert.match(html, /Singapore/);
    assert.match(html, /View website/);
    assert.match(html, /View map/);
    assert.match(html, /10 Bayfront Avenue/);
    assert.match(html, /href="https:\/\/example.com"/);
    assert.match(html, /href="https:\/\/www\.google\.com\/maps\/search/);
    assert.match(html, /target="_blank"/);
    assert.match(html, /rel="noopener noreferrer"/);
  });

  it("shows archived badge without hiding venue details", () => {
    const html = renderToStaticMarkup(
      <EventVenueSection
        venue={{ ...baseVenue, archived_at: "2026-01-01T00:00:00" }}
        cityLabel="Singapore"
        embedded
      />,
    );

    assert.match(html, /Historical venue record/);
    assert.match(html, /Marina Bay Sands Expo/);
  });

  it("omits optional blocks when data is missing", () => {
    const html = renderToStaticMarkup(
      <EventVenueSection
        venue={{
          ...baseVenue,
          logo_url: null,
          website_url: null,
          address_text: null,
        }}
        cityLabel=""
        embedded
      />,
    );

    assert.doesNotMatch(html, /View website/);
    assert.doesNotMatch(html, /<img/);
    assert.match(html, /View map/);
  });
});

describe("EventVenueEmptyState", () => {
  it("renders empty state copy with optional city context", () => {
    const html = renderToStaticMarkup(
      <EventVenueEmptyState cityLabel="Las Vegas, Nevada" embedded />,
    );

    assert.match(html, /<h2[^>]*>Venue<\/h2>/);
    assert.match(html, /Venue not specified for this event/);
    assert.match(html, /City-level location: Las Vegas, Nevada/);
    assert.match(html, /Overview tab/);
  });
});
