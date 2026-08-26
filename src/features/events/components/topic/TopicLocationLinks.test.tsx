import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { TopicLocationLinks } from "@/src/features/events/components/topic/TopicLocationLinks";
import type { PublishedResearchPage } from "@/src/features/research-pages/server/researchPagesPublic";

function makePage(
  overrides: Partial<PublishedResearchPage> = {},
): PublishedResearchPage {
  return {
    id: "page-1",
    topicName: "Crypto & Blockchain",
    topicSlug: "crypto-blockchain",
    locationType: "region",
    locationName: "Asia",
    locationSlug: "asia",
    year: null,
    publishedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("TopicLocationLinks", () => {
  it("renders nothing when the topic has no published research pages", () => {
    const html = renderToStaticMarkup(
      <TopicLocationLinks topicName="AI" pages={[]} />,
    );
    assert.equal(html, "");
  });

  it("links all-years region pages to the region path", () => {
    const html = renderToStaticMarkup(
      <TopicLocationLinks
        topicName="Crypto & Blockchain"
        pages={[makePage()]}
      />,
    );
    assert.match(html, /By location/);
    assert.match(html, /href="\/events\/topics\/crypto-blockchain\/regions\/asia"/);
    assert.match(html, /Crypto &amp; Blockchain events in Asia/);
    assert.doesNotMatch(html, /\/years\//);
  });

  it("links country pages to the country segment", () => {
    const html = renderToStaticMarkup(
      <TopicLocationLinks
        topicName="Crypto & Blockchain"
        pages={[
          makePage({
            id: "page-sg",
            locationType: "country",
            locationName: "Singapore",
            locationSlug: "singapore",
            year: 2026,
          }),
        ]}
      />,
    );
    assert.match(
      html,
      /href="\/events\/topics\/crypto-blockchain\/countries\/singapore\/years\/2026"/,
    );
    assert.match(html, /Crypto &amp; Blockchain events in Singapore \(2026\)/);
    assert.doesNotMatch(html, /\/regions\//);
  });

  it("links year-scoped pages to the year path and labels the year", () => {
    const html = renderToStaticMarkup(
      <TopicLocationLinks
        topicName="FinTech"
        pages={[
          makePage({
            id: "page-2",
            topicName: "FinTech",
            topicSlug: "fintech",
            year: 2026,
          }),
        ]}
      />,
    );
    assert.match(
      html,
      /href="\/events\/topics\/fintech\/regions\/asia\/years\/2026"/,
    );
    assert.match(html, /FinTech events in Asia \(2026\)/);
  });

  it("renders one link per published page", () => {
    const html = renderToStaticMarkup(
      <TopicLocationLinks
        topicName="FinTech"
        pages={[
          makePage({ id: "a", topicSlug: "fintech", locationSlug: "asia" }),
          makePage({
            id: "b",
            topicSlug: "fintech",
            locationName: "Europe",
            locationSlug: "europe",
          }),
        ]}
      />,
    );
    assert.equal(html.match(/<a /g)?.length, 2);
    assert.match(html, /regions\/asia"/);
    assert.match(html, /regions\/europe"/);
  });
});
