import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildEventExplorerCalendarUrl,
  buildEventExplorerTopicUrl,
  buildTopicHubPath,
  parseEventExplorerMonth,
  parseEventExplorerView,
} from "@/src/lib/routes/explorerUrls";

describe("buildTopicHubPath", () => {
  it("builds a topic hub path from slug", () => {
    assert.equal(buildTopicHubPath("crypto"), "/topics/crypto");
    assert.equal(buildTopicHubPath(" web3 "), "/topics/web3");
    assert.equal(buildTopicHubPath(""), null);
  });
});

describe("buildEventExplorerTopicUrl", () => {
  it("builds an events explorer URL with topic param", () => {
    assert.equal(buildEventExplorerTopicUrl("crypto"), "/events?topic=crypto");
    assert.equal(buildEventExplorerTopicUrl(" web3 "), "/events?topic=web3");
    assert.equal(buildEventExplorerTopicUrl(""), "/events");
  });
});

describe("buildEventExplorerCalendarUrl", () => {
  it("builds an events explorer URL with calendar view and month", () => {
    assert.equal(
      buildEventExplorerCalendarUrl("2026-06"),
      "/events?view=calendar&month=2026-06",
    );
    assert.equal(
      buildEventExplorerCalendarUrl(" 2026-01 "),
      "/events?view=calendar&month=2026-01",
    );
  });

  it("falls back to the current month when month is invalid", () => {
    const href = buildEventExplorerCalendarUrl("invalid");
    assert.match(href, /^\/events\?view=calendar&month=\d{4}-\d{2}$/);
  });
});

describe("parseEventExplorerView", () => {
  it("returns calendar only for the calendar value", () => {
    assert.equal(parseEventExplorerView("calendar"), "calendar");
    assert.equal(parseEventExplorerView(" Calendar "), "calendar");
    assert.equal(parseEventExplorerView(null), "list");
    assert.equal(parseEventExplorerView(""), "list");
    assert.equal(parseEventExplorerView("list"), "list");
    assert.equal(parseEventExplorerView("invalid"), "list");
  });
});

describe("parseEventExplorerMonth", () => {
  it("returns a valid YYYY-MM month or null", () => {
    assert.equal(parseEventExplorerMonth("2026-06"), "2026-06");
    assert.equal(parseEventExplorerMonth(" 2026-01 "), "2026-01");
    assert.equal(parseEventExplorerMonth("2026-13"), null);
    assert.equal(parseEventExplorerMonth("2026-00"), null);
    assert.equal(parseEventExplorerMonth("2026-6"), null);
    assert.equal(parseEventExplorerMonth("invalid"), null);
    assert.equal(parseEventExplorerMonth(null), null);
  });
});
