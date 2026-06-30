import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  eventExplorerDomainMatchesHosts,
  eventExplorerDomainMatchesQuery,
  normalizeEventExplorerWebsiteHost,
  readEventExplorerWebsiteHosts,
} from "@/src/features/events/lib/eventExplorerDomain";

describe("normalizeEventExplorerWebsiteHost", () => {
  it("normalizes bare domains, www, and full URLs to canonical host", () => {
    assert.equal(normalizeEventExplorerWebsiteHost("blockworks.com"), "blockworks.com");
    assert.equal(normalizeEventExplorerWebsiteHost("www.blockworks.com"), "blockworks.com");
    assert.equal(normalizeEventExplorerWebsiteHost("https://blockworks.com/"), "blockworks.com");
    assert.equal(
      normalizeEventExplorerWebsiteHost("https://blockworks.com/events"),
      "blockworks.com",
    );
    assert.equal(normalizeEventExplorerWebsiteHost("http://WWW.Token2049.com/sg"), "token2049.com");
  });

  it("returns empty string for blank input", () => {
    assert.equal(normalizeEventExplorerWebsiteHost(""), "");
    assert.equal(normalizeEventExplorerWebsiteHost("   "), "");
  });
});

describe("readEventExplorerWebsiteHosts", () => {
  it("reads edition and series website hosts", () => {
    assert.deepEqual(
      readEventExplorerWebsiteHosts({
        website_url: "https://edition.example.com/2026",
        event_series: { website_url: "www.series.example.com" },
      }),
      {
        edition: "edition.example.com",
        series: "series.example.com",
      },
    );
  });
});

describe("eventExplorerDomainMatchesQuery", () => {
  const source = {
    website_url: "https://blockworks.com/events",
    event_series: { website_url: "https://www.token2049.com" },
  };
  const hosts = readEventExplorerWebsiteHosts(source);

  it("matches exact, prefix, and partial domain queries", () => {
    assert.equal(eventExplorerDomainMatchesQuery(source, "blockworks.com", "exact"), true);
    assert.equal(eventExplorerDomainMatchesQuery(source, "https://blockworks.com/", "exact"), true);
    assert.equal(eventExplorerDomainMatchesQuery(source, "token2049.com", "exact"), true);
    assert.equal(eventExplorerDomainMatchesHosts(hosts, "blockworks", "prefix"), true);
    assert.equal(eventExplorerDomainMatchesHosts(hosts, "token", "includes"), true);
    assert.equal(eventExplorerDomainMatchesQuery(source, "unrelated.com", "exact"), false);
  });
});
