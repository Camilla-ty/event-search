import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildEventJsonLd,
  type BuildEventJsonLdInput,
} from "@/src/lib/seo/eventJsonLd";
import { serializeJsonLd } from "@/src/components/seo/JsonLd";

const SITE = new URL("https://app.eventpx.com/");

function baseInput(
  overrides: Partial<BuildEventJsonLdInput> = {},
): BuildEventJsonLdInput {
  return {
    name: "TOKEN2049 Singapore 2025",
    slug: "token2049-singapore-2025",
    id: "edition-1",
    startDate: "2025-10-01",
    endDate: "2025-10-02",
    city: {
      city: "Singapore",
      state: null,
      country: "Singapore",
    },
    venue: {
      name: "Marina Bay Sands",
      archived_at: null,
    },
    organizers: [
      {
        name: "Untraceable",
        slug: "untraceable",
        id: "org-1",
        restricted_at: null,
      },
    ],
    imageUrl: "https://cdn.example.com/series/logo.png",
    description:
      "TOKEN2049 Singapore 2025 is an event from the TOKEN2049 event brand.",
    series: {
      name: "TOKEN2049",
      slug: "token2049",
      id: "series-1",
    },
    siteUrl: SITE,
    ...overrides,
  };
}

const FORBIDDEN_KEYS = [
  "eventStatus",
  "eventAttendanceMode",
  "offers",
  "keywords",
  "streetAddress",
  "sponsor",
  "sponsors",
  "exhibitor",
  "exhibitors",
  "partnerAlumni",
] as const;

function assertNoForbidden(graph: Record<string, unknown>) {
  for (const key of FORBIDDEN_KEYS) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(graph, key),
      false,
      `forbidden property ${key} must not be emitted`,
    );
  }
  const location = graph.location as Record<string, unknown> | undefined;
  if (location?.address && typeof location.address === "object") {
    const address = location.address as Record<string, unknown>;
    assert.equal(
      Object.prototype.hasOwnProperty.call(address, "streetAddress"),
      false,
    );
  }
}

describe("buildEventJsonLd", () => {
  it("builds a full valid Event graph", () => {
    const graph = buildEventJsonLd(baseInput());
    assert.ok(graph);
    assert.equal(graph["@context"], "https://schema.org");
    assert.equal(graph["@type"], "Event");
    assert.equal(
      graph["@id"],
      "https://app.eventpx.com/events/token2049-singapore-2025",
    );
    assert.equal(graph.name, "TOKEN2049 Singapore 2025");
    assert.equal(
      graph.url,
      "https://app.eventpx.com/events/token2049-singapore-2025",
    );
    assert.equal(graph.startDate, "2025-10-01");
    assert.equal(graph.endDate, "2025-10-02");
    assert.deepEqual(graph.location, {
      "@type": "Place",
      name: "Marina Bay Sands",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Singapore",
        addressCountry: "Singapore",
      },
    });
    assert.deepEqual(graph.organizer, {
      "@type": "Organization",
      name: "Untraceable",
      url: "https://app.eventpx.com/sponsors/untraceable",
    });
    assert.equal(graph.image, "https://cdn.example.com/series/logo.png");
    assert.equal(
      graph.description,
      "TOKEN2049 Singapore 2025 is an event from the TOKEN2049 event brand.",
    );
    assert.deepEqual(graph.isPartOf, {
      "@type": "Brand",
      name: "TOKEN2049",
      url: "https://app.eventpx.com/events/series/token2049",
    });
    assertNoForbidden(graph as unknown as Record<string, unknown>);
  });

  it("returns null when name cannot be established", () => {
    assert.equal(buildEventJsonLd(baseInput({ name: "  " })), null);
    assert.equal(buildEventJsonLd(baseInput({ name: "" })), null);
  });

  it("returns null when canonical path cannot be established", () => {
    assert.equal(
      buildEventJsonLd(baseInput({ slug: null, id: null })),
      null,
    );
    assert.equal(
      buildEventJsonLd(baseInput({ slug: "  ", id: "" })),
      null,
    );
  });

  it("omits dates when missing", () => {
    const graph = buildEventJsonLd(
      baseInput({ startDate: null, endDate: null }),
    );
    assert.ok(graph);
    assert.equal(graph.startDate, undefined);
    assert.equal(graph.endDate, undefined);
  });

  it("omits invalid end date and keeps valid startDate", () => {
    const invalidFormat = buildEventJsonLd(
      baseInput({ startDate: "2025-10-01", endDate: "not-a-date" }),
    );
    assert.ok(invalidFormat);
    assert.equal(invalidFormat.startDate, "2025-10-01");
    assert.equal(invalidFormat.endDate, undefined);

    const beforeStart = buildEventJsonLd(
      baseInput({ startDate: "2025-10-02", endDate: "2025-10-01" }),
    );
    assert.ok(beforeStart);
    assert.equal(beforeStart.startDate, "2025-10-02");
    assert.equal(beforeStart.endDate, undefined);
  });

  it("omits location when city and public venue are missing", () => {
    const graph = buildEventJsonLd(
      baseInput({ city: null, venue: null }),
    );
    assert.ok(graph);
    assert.equal(graph.location, undefined);
  });

  it("omits archived venue name but keeps city address", () => {
    const graph = buildEventJsonLd(
      baseInput({
        venue: {
          name: "Old Hall",
          archived_at: "2024-01-01T00:00:00.000Z",
        },
      }),
    );
    assert.ok(graph);
    assert.deepEqual(graph.location, {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Singapore",
        addressCountry: "Singapore",
      },
    });
  });

  it("omits restricted organizers", () => {
    const graph = buildEventJsonLd(
      baseInput({
        organizers: [
          {
            name: "Restricted Co",
            slug: "restricted-co",
            id: "r1",
            restricted_at: "2026-01-01T00:00:00.000Z",
          },
          {
            name: "Safe Co",
            slug: "safe-co",
            id: "s1",
            restricted_at: null,
          },
        ],
      }),
    );
    assert.ok(graph);
    assert.deepEqual(graph.organizer, {
      "@type": "Organization",
      name: "Safe Co",
      url: "https://app.eventpx.com/sponsors/safe-co",
    });
  });

  it("omits organizer when all are restricted", () => {
    const graph = buildEventJsonLd(
      baseInput({
        organizers: [
          {
            name: "Restricted Co",
            slug: "restricted-co",
            id: "r1",
            restricted_at: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
    );
    assert.ok(graph);
    assert.equal(graph.organizer, undefined);
  });

  it("omits image, description, and series when missing", () => {
    const graph = buildEventJsonLd(
      baseInput({
        imageUrl: null,
        description: null,
        series: null,
      }),
    );
    assert.ok(graph);
    assert.equal(graph.image, undefined);
    assert.equal(graph.description, undefined);
    assert.equal(graph.isPartOf, undefined);
  });

  it("omits non-absolute image URLs", () => {
    const graph = buildEventJsonLd(
      baseInput({ imageUrl: "/brand/logo-wordmark.svg" }),
    );
    assert.ok(graph);
    assert.equal(graph.image, undefined);
  });

  it("does not emit forbidden properties", () => {
    const graph = buildEventJsonLd(baseInput());
    assert.ok(graph);
    assertNoForbidden(graph as unknown as Record<string, unknown>);
  });
});

describe("serializeJsonLd", () => {
  it("safely serializes strings containing </script>", () => {
    const payload = {
      "@type": "Event",
      name: 'Evil </script><script>alert(1)</script>',
      description: "A <b>bold</b> claim",
    };
    const serialized = serializeJsonLd(payload);
    assert.equal(serialized.includes("<"), false);
    assert.equal(serialized.includes("</script>"), false);
    assert.match(serialized, /\\u003c/);
    assert.deepEqual(JSON.parse(serialized), payload);
  });
});
