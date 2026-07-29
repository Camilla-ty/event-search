import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { JsonLd, serializeJsonLd } from "@/src/components/seo/JsonLd";
import {
  buildOrganizationJsonLd,
  type BuildOrganizationJsonLdInput,
} from "@/src/lib/seo/organizationJsonLd";

const SITE = new URL("https://app.eventpx.com/");

function baseInput(
  overrides: Partial<BuildOrganizationJsonLdInput> = {},
): BuildOrganizationJsonLdInput {
  return {
    name: "OKX",
    slug: "okx",
    id: "company-1",
    restricted_at: null,
    logoUrl: "https://cdn.example.com/logos/okx.png",
    website: "https://www.okx.com",
    domain: "okx.com",
    description:
      "OKX is a company profiled on EventPixels; its website is okx.com. It has sponsored 12 events recorded on EventPixels. The full list of sponsored events is available to logged-in users.",
    city: {
      city: "Malta",
      state: null,
      country: "Malta",
    },
    siteUrl: SITE,
    ...overrides,
  };
}

const FORBIDDEN_KEYS = [
  "image",
  "foundingDate",
  "legalName",
  "alternateName",
  "parentOrganization",
  "subOrganization",
  "sponsor",
  "memberOf",
  "streetAddress",
] as const;

function assertNoForbidden(graph: Record<string, unknown>) {
  for (const key of FORBIDDEN_KEYS) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(graph, key),
      false,
      `forbidden property ${key} must not be emitted`,
    );
  }
  const address = graph.address as Record<string, unknown> | undefined;
  if (address) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(address, "streetAddress"),
      false,
    );
  }
}

describe("buildOrganizationJsonLd", () => {
  it("builds a full valid Organization graph", () => {
    const graph = buildOrganizationJsonLd(baseInput());
    assert.ok(graph);
    assert.equal(graph["@context"], "https://schema.org");
    assert.equal(graph["@type"], "Organization");
    assert.equal(graph["@id"], "https://app.eventpx.com/sponsors/okx");
    assert.equal(graph.name, "OKX");
    assert.equal(graph.url, "https://app.eventpx.com/sponsors/okx");
    assert.equal(graph.logo, "https://cdn.example.com/logos/okx.png");
    assert.equal(graph.sameAs, "https://www.okx.com/");
    assert.equal(
      graph.description,
      "OKX is a company profiled on EventPixels; its website is okx.com. It has sponsored 12 events recorded on EventPixels. The full list of sponsored events is available to logged-in users.",
    );
    assert.deepEqual(graph.address, {
      "@type": "PostalAddress",
      addressLocality: "Malta",
      addressCountry: "Malta",
    });
    assertNoForbidden(graph as unknown as Record<string, unknown>);
  });

  it("returns null when name is missing", () => {
    assert.equal(buildOrganizationJsonLd(baseInput({ name: "" })), null);
    assert.equal(buildOrganizationJsonLd(baseInput({ name: "  " })), null);
  });

  it("returns null when canonical path cannot be established", () => {
    assert.equal(
      buildOrganizationJsonLd(baseInput({ slug: null, id: null })),
      null,
    );
    assert.equal(
      buildOrganizationJsonLd(baseInput({ slug: "  ", id: "" })),
      null,
    );
  });

  it("returns null for restricted companies", () => {
    assert.equal(
      buildOrganizationJsonLd(
        baseInput({ restricted_at: "2026-01-01T00:00:00.000Z" }),
      ),
      null,
    );
  });

  it("omits logo when missing or not an absolute image URL", () => {
    const missing = buildOrganizationJsonLd(baseInput({ logoUrl: null }));
    assert.ok(missing);
    assert.equal(missing.logo, undefined);

    const relative = buildOrganizationJsonLd(
      baseInput({ logoUrl: "/brand/logo-wordmark.svg" }),
    );
    assert.ok(relative);
    assert.equal(relative.logo, undefined);
  });

  it("omits sameAs when no official website is available", () => {
    const graph = buildOrganizationJsonLd(
      baseInput({ website: null, domain: null }),
    );
    assert.ok(graph);
    assert.equal(graph.sameAs, undefined);
  });

  it("omits address when city data is missing", () => {
    const graph = buildOrganizationJsonLd(baseInput({ city: null }));
    assert.ok(graph);
    assert.equal(graph.address, undefined);
  });

  it("omits description when factual summary is missing", () => {
    const graph = buildOrganizationJsonLd(baseInput({ description: null }));
    assert.ok(graph);
    assert.equal(graph.description, undefined);
  });

  it("does not emit forbidden properties", () => {
    const graph = buildOrganizationJsonLd(baseInput());
    assert.ok(graph);
    assertNoForbidden(graph as unknown as Record<string, unknown>);
  });

  it("serializes safely through JsonLd for strings containing </script>", () => {
    const graph = buildOrganizationJsonLd(
      baseInput({
        name: 'Evil </script><script>alert(1)</script>',
        description: "A <b>bold</b> claim",
      }),
    );
    assert.ok(graph);

    const serialized = serializeJsonLd(graph);
    assert.equal(serialized.includes("<"), false);
    assert.equal(serialized.includes("</script>"), false);
    assert.deepEqual(JSON.parse(serialized), graph);

    const html = renderToStaticMarkup(<JsonLd data={graph} />);
    assert.match(html, /type="application\/ld\+json"/);
    assert.doesNotMatch(html, /<\/script><script>/);
    const start = html.indexOf(">") + 1;
    const end = html.lastIndexOf("</script>");
    assert.deepEqual(JSON.parse(html.slice(start, end)), graph);
  });
});
