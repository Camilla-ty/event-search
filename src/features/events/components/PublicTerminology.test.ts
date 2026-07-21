import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const PUBLIC_COPY_FILES = [
  {
    path: "./series/SeriesHubHeader.tsx",
    expected: "Recurring event brand — browse all events below.",
  },
  {
    path: "./series/SeriesEditionsList.tsx",
    expected: "No public events are listed for this event brand yet.",
  },
  {
    path: "./topic/TopicHubHeader.tsx",
    expected: "Event brands and events tagged with this topic on EventPixels.",
  },
  {
    path: "./bitcoin-asia/BitcoinAsiaHubView.tsx",
    expected: "Event brand:",
  },
] as const;

describe("public event terminology", () => {
  for (const entry of PUBLIC_COPY_FILES) {
    it(`uses Event Brand and Event copy in ${entry.path}`, () => {
      const source = readFileSync(new URL(entry.path, import.meta.url), "utf8");

      assert.match(source, new RegExp(entry.expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.doesNotMatch(
        source,
        /browse all editions|no public editions|event brands and editions/i,
      );
    });
  }
});
