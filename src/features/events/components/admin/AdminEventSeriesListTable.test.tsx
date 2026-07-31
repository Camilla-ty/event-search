import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { AdminEventSeriesListTable } from "@/src/features/events/components/admin/AdminEventSeriesListTable";
import {
  eventSeriesListLifecycleBadge,
  formatEventSeriesListWebsiteHost,
} from "@/src/features/events/components/admin/adminEventSeriesListDisplay";
import type { EventSeriesListItem } from "@/src/features/events/server/eventSeriesAdmin";

function seriesRow(overrides: Partial<EventSeriesListItem> = {}): EventSeriesListItem {
  return {
    id: "series-1",
    name: "TOKEN2049",
    slug: "token2049",
    website_url: "https://www.token2049.com/singapore",
    logo_url: "event-series/series-1/logo.png",
    lifecycle_status: "active",
    merged_into_series_id: null,
    company_profile_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    edition_count: 3,
    has_keywords: true,
    ...overrides,
  };
}

describe("adminEventSeriesListDisplay", () => {
  it("formats website hostname without path or www", () => {
    assert.equal(
      formatEventSeriesListWebsiteHost("https://www.token2049.com/singapore"),
      "token2049.com",
    );
    assert.equal(formatEventSeriesListWebsiteHost(null), null);
    assert.equal(formatEventSeriesListWebsiteHost(""), null);
  });

  it("maps lifecycle statuses to list badges including Not set warning", () => {
    assert.deepEqual(eventSeriesListLifecycleBadge("active"), {
      label: "Active",
      variant: "success",
    });
    assert.deepEqual(eventSeriesListLifecycleBadge("discontinued"), {
      label: "Discontinued",
      variant: "neutral",
    });
    assert.deepEqual(eventSeriesListLifecycleBadge("merged"), {
      label: "Merged",
      variant: "default",
    });
    assert.deepEqual(eventSeriesListLifecycleBadge(null), {
      label: "Not set",
      variant: "warning",
    });
    assert.deepEqual(eventSeriesListLifecycleBadge(""), {
      label: "Not set",
      variant: "warning",
    });
  });
});

describe("AdminEventSeriesListTable", () => {
  it("renders reordered columns, name wrap classes, SEO presence, and existing list behavior", () => {
    const html = renderToStaticMarkup(
      <AdminEventSeriesListTable
        series={[
          seriesRow({
            name: "GITEX FDX(Future Finance & Digital Assets Expo)",
          }),
          seriesRow({
            id: "series-2",
            name: "Future Shell",
            website_url: null,
            logo_url: null,
            lifecycle_status: null,
            edition_count: 0,
            has_keywords: false,
          }),
          seriesRow({
            id: "series-3",
            name: "Legacy Brand",
            website_url: "https://example.com",
            lifecycle_status: "discontinued",
            edition_count: 1,
            has_keywords: true,
          }),
          seriesRow({
            id: "series-4",
            name: "Old Name",
            lifecycle_status: "merged",
            edition_count: 2,
            has_keywords: false,
          }),
        ]}
      />,
    );

    assert.match(html, />Event Series</);
    assert.match(html, />Website</);
    assert.match(html, />Lifecycle</);
    assert.match(html, />Logo</);
    assert.match(html, />SEO</);
    assert.match(html, />Editions</);
    assert.doesNotMatch(html, />Slug</);
    assert.doesNotMatch(html, />Actions</);
    assert.doesNotMatch(html, />View</);

    const eventSeriesIdx = html.indexOf(">Event Series<");
    const websiteIdx = html.indexOf(">Website<");
    const lifecycleIdx = html.indexOf(">Lifecycle<");
    const logoIdx = html.indexOf(">Logo<");
    const seoIdx = html.indexOf(">SEO<");
    const editionsIdx = html.indexOf(">Editions<");
    assert.ok(eventSeriesIdx < websiteIdx);
    assert.ok(websiteIdx < lifecycleIdx);
    assert.ok(lifecycleIdx < logoIdx);
    assert.ok(logoIdx < seoIdx);
    assert.ok(seoIdx < editionsIdx);

    assert.match(html, /max-w-\[11rem\]/);
    assert.match(html, /whitespace-normal break-words/);
    assert.doesNotMatch(html, /line-clamp|truncate[^"]*text-slate-900/);

    assert.match(html, /href="\/admin\/events\/series\/series-1"/);
    assert.match(html, /GITEX FDX\(Future Finance &amp; Digital Assets Expo\)/);
    assert.match(html, /after:absolute after:inset-0/);

    assert.match(html, />token2049\.com</);
    assert.doesNotMatch(html, /https:\/\/www\.token2049\.com\/singapore/);
    assert.match(html, /text-slate-400[^>]*>—</);

    assert.match(html, />Active</);
    assert.match(html, />Discontinued</);
    assert.match(html, />Merged</);
    assert.match(html, />Not set</);
    assert.match(html, /bg-brand-warning\/20/);

    assert.match(html, /aria-label="Has keywords"[^>]*>✓</);
    assert.equal((html.match(/aria-label="Has keywords"/g) ?? []).length, 2);
    assert.equal((html.match(/text-slate-400[^>]*>—</g) ?? []).length >= 2, true);

    assert.match(html, />0</);
    assert.match(html, />3</);
  });

  it("preserves the empty-state create link", () => {
    const html = renderToStaticMarkup(<AdminEventSeriesListTable series={[]} />);

    assert.match(html, /No event series yet/);
    assert.match(html, /href="\/admin\/events\/series\/new"/);
    assert.match(html, />Create one</);
    assert.match(html, /colSpan=\{6\}|colspan="6"/i);
  });
});
