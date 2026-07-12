import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  editionMatchesTopicSeriesIds,
  mergeTopicSeriesResolutions,
  readEditionSeriesId,
} from "@/src/features/events/server/getEventExplorerData";
import { readSponsorCountForEdition } from "@/src/lib/queries/companies";

describe("explorer sponsor count wiring", () => {
  it("maps sponsorCountsByEditionId onto catalog editions", () => {
    const catalog = [{ id: "585aa4e5-25ba-4182-9c2a-c524eea8b82b", name: "BTC Prague 2026" }];
    const sponsorCountsByEditionId = new Map([
      ["585aa4e5-25ba-4182-9c2a-c524eea8b82b", 81],
    ]);

    const editionsWithSponsorCounts = catalog.map((edition) => ({
      ...edition,
      sponsor_count: readSponsorCountForEdition(
        sponsorCountsByEditionId,
        String(edition.id),
      ),
    }));

    assert.equal(editionsWithSponsorCounts[0]?.sponsor_count, 81);
  });
});

describe("readEditionSeriesId", () => {
  it("reads a trimmed series id", () => {
    assert.equal(readEditionSeriesId({ series_id: " abc " }), "abc");
    assert.equal(readEditionSeriesId({ series_id: "" }), "");
    assert.equal(readEditionSeriesId({}), "");
  });
});

describe("editionMatchesTopicSeriesIds", () => {
  it("allows all editions when no topic filter is active", () => {
    assert.equal(editionMatchesTopicSeriesIds({ series_id: "a" }, null), true);
  });

  it("matches editions whose series id is in the topic set", () => {
    const seriesIds = new Set(["series-a", "series-b"]);
    assert.equal(
      editionMatchesTopicSeriesIds({ series_id: "series-a" }, seriesIds),
      true,
    );
    assert.equal(
      editionMatchesTopicSeriesIds({ series_id: "series-c" }, seriesIds),
      false,
    );
    assert.equal(editionMatchesTopicSeriesIds({ series_id: null }, seriesIds), false);
  });

  it("matches nothing when the topic set is empty", () => {
    assert.equal(
      editionMatchesTopicSeriesIds({ series_id: "series-a" }, new Set()),
      false,
    );
  });
});

describe("mergeTopicSeriesResolutions", () => {
  it("returns null topicSeriesIds for an empty topics array", () => {
    const result = mergeTopicSeriesResolutions([]);
    assert.equal(result.activeTopic, null);
    assert.equal(result.topicUnknown, false);
    assert.equal(result.topicSeriesIds, null);
  });

  it("resolves a single known topic", () => {
    const result = mergeTopicSeriesResolutions([
      {
        slug: "bitcoin",
        keyword: { slug: "bitcoin", name: "Bitcoin" },
        seriesIds: ["series-a"],
      },
    ]);

    assert.deepEqual(result.activeTopic, { slug: "bitcoin", name: "Bitcoin" });
    assert.equal(result.topicUnknown, false);
    assert.deepEqual(result.topicSeriesIds, new Set(["series-a"]));
  });

  it("unions series IDs across multiple topics with OR semantics", () => {
    const result = mergeTopicSeriesResolutions([
      {
        slug: "bitcoin",
        keyword: { slug: "bitcoin", name: "Bitcoin" },
        seriesIds: ["series-a", "series-b"],
      },
      {
        slug: "ai",
        keyword: { slug: "ai", name: "AI" },
        seriesIds: ["series-c"],
      },
    ]);

    assert.equal(result.topicUnknown, false);
    assert.deepEqual(
      result.topicSeriesIds,
      new Set(["series-a", "series-b", "series-c"]),
    );
  });

  it("deduplicates overlapping series IDs across topics", () => {
    const result = mergeTopicSeriesResolutions([
      {
        slug: "bitcoin",
        keyword: { slug: "bitcoin", name: "Bitcoin" },
        seriesIds: ["series-a", "series-shared"],
      },
      {
        slug: "ai",
        keyword: { slug: "ai", name: "AI" },
        seriesIds: ["series-shared", "series-b"],
      },
    ]);

    assert.deepEqual(
      result.topicSeriesIds,
      new Set(["series-a", "series-shared", "series-b"]),
    );
  });

  it("ignores unknown topic slugs without throwing", () => {
    const result = mergeTopicSeriesResolutions([
      {
        slug: "missing",
        keyword: null,
        seriesIds: [],
      },
    ]);

    assert.equal(result.activeTopic, null);
    assert.equal(result.topicUnknown, true);
    assert.deepEqual(result.topicSeriesIds, new Set());
  });

  it("unions known topics while skipping unknown slugs", () => {
    const result = mergeTopicSeriesResolutions([
      {
        slug: "missing",
        keyword: null,
        seriesIds: [],
      },
      {
        slug: "ai",
        keyword: { slug: "ai", name: "AI" },
        seriesIds: ["series-b"],
      },
    ]);

    assert.equal(result.activeTopic, null);
    assert.equal(result.topicUnknown, true);
    assert.deepEqual(result.topicSeriesIds, new Set(["series-b"]));
  });

  it("returns an empty set when every topic slug is unknown", () => {
    const result = mergeTopicSeriesResolutions([
      { slug: "missing-a", keyword: null, seriesIds: [] },
      { slug: "missing-b", keyword: null, seriesIds: [] },
    ]);

    assert.equal(result.topicUnknown, true);
    assert.deepEqual(result.topicSeriesIds, new Set());
  });
});
