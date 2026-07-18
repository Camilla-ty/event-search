import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildSeriesMetadataDescription } from "@/src/lib/seo/seriesMetadata";

describe("buildSeriesMetadataDescription", () => {
  it("uses a length-capped factual summary when editions exist", () => {
    const description = buildSeriesMetadataDescription({
      name: "TOKEN2049",
      lifecycleStatus: "active",
      editions: [
        {
          name: "TOKEN2049 Singapore 2025",
          year: 2025,
          startDate: "2025-10-01",
          endDate: "2025-10-02",
          locationLabel: "Singapore",
        },
        {
          name: "TOKEN2049 Dubai 2024",
          year: 2024,
          startDate: "2024-04-18",
          endDate: "2024-04-19",
          locationLabel: "Dubai",
        },
      ],
      topics: ["Bitcoin"],
      now: new Date("2026-07-18T00:00:00.000Z"),
    });

    assert.ok(description.startsWith("TOKEN2049 is an event series"));
    assert.ok(description.length <= 155);
    assert.doesNotMatch(description, /premier|largest|flagship/i);
  });

  it("falls back to a name template when summary is unavailable", () => {
    const description = buildSeriesMetadataDescription({
      name: "Merged Brand",
      lifecycleStatus: "merged",
    });

    assert.equal(
      description,
      "Merged Brand — all events and editions on EventPixels.",
    );
  });
});
