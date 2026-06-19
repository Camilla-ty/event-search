import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  editionMatchesTopicSeriesIds,
  readEditionSeriesId,
} from "@/src/features/events/server/getEventExplorerData";

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
