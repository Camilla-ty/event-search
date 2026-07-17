import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createNotFoundPageMetadata,
  createPageMetadata,
  getSiteUrl,
  PRODUCTION_SITE_ORIGIN,
  rootSiteMetadata,
} from "@/src/lib/metadata/site";

describe("getSiteUrl", () => {
  it("uses the production app origin by default outside local development", () => {
    const url = getSiteUrl({
      NODE_ENV: "production",
      VERCEL: "1",
      VERCEL_ENV: "production",
      VERCEL_URL: "handshakes-git-main-acme.vercel.app",
    });

    assert.equal(url.origin, PRODUCTION_SITE_ORIGIN);
  });

  it("ignores VERCEL_URL on preview deployments", () => {
    const url = getSiteUrl({
      NODE_ENV: "production",
      VERCEL: "1",
      VERCEL_ENV: "preview",
      VERCEL_URL: "handshakes-git-feature-acme.vercel.app",
    });

    assert.equal(url.toString(), `${PRODUCTION_SITE_ORIGIN}/`);
  });

  it("rejects NEXT_PUBLIC_SITE_URL when it points at a Vercel deployment host", () => {
    const url = getSiteUrl({
      NODE_ENV: "production",
      NEXT_PUBLIC_SITE_URL: "https://handshakes-xyz.vercel.app",
      VERCEL_URL: "handshakes-xyz.vercel.app",
    });

    assert.equal(url.origin, PRODUCTION_SITE_ORIGIN);
  });

  it("allows an explicit non-Vercel NEXT_PUBLIC_SITE_URL override", () => {
    const url = getSiteUrl({
      NODE_ENV: "production",
      NEXT_PUBLIC_SITE_URL: "https://staging.eventpx.com",
    });

    assert.equal(url.toString(), "https://staging.eventpx.com/");
  });

  it("uses localhost only for non-Vercel local development", () => {
    const url = getSiteUrl({
      NODE_ENV: "development",
    });

    assert.equal(url.toString(), "http://localhost:3000/");
  });
});

describe("createPageMetadata", () => {
  it("emits canonical and openGraph urls under the production origin", () => {
    assert.equal(
      new URL(String(rootSiteMetadata.metadataBase)).origin,
      getSiteUrl().origin,
    );

    const metadata = createPageMetadata({
      title: "Acme",
      path: "/sponsors/acme",
    });

    const base = getSiteUrl().origin;
    assert.equal(metadata.alternates?.canonical, `${base}/sponsors/acme`);
    assert.equal(metadata.openGraph?.url, `${base}/sponsors/acme`);
    assert.doesNotMatch(String(metadata.alternates?.canonical), /vercel\.app/);
    assert.doesNotMatch(String(metadata.openGraph?.url), /vercel\.app/);
    assert.equal(metadata.robots, undefined);
  });

  it("emits noindex follow when robots are provided", () => {
    const metadata = createPageMetadata({
      title: "Thin company",
      path: "/sponsors/thin",
      robots: { index: false, follow: true },
    });
    assert.deepEqual(metadata.robots, { index: false, follow: true });
    assert.equal(
      metadata.alternates?.canonical,
      `${getSiteUrl().origin}/sponsors/thin`,
    );
  });
});

describe("createNotFoundPageMetadata", () => {
  it("is never indexable and avoids entity not-found titles", () => {
    const metadata = createNotFoundPageMetadata("/events/missing");
    assert.equal(metadata.title, "Not found");
    assert.deepEqual(metadata.robots, { index: false, follow: true });
    assert.doesNotMatch(String(metadata.title), /Event not found/i);
    assert.doesNotMatch(String(metadata.title), /Sponsor not found/i);
    assert.doesNotMatch(String(metadata.alternates?.canonical), /vercel\.app/);
    assert.equal(
      String(metadata.alternates?.canonical).startsWith(PRODUCTION_SITE_ORIGIN) ||
        String(metadata.alternates?.canonical).startsWith("http://localhost"),
      true,
    );
  });
});
