import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { CompanySameBrandSeriesSection } from "@/src/features/companies/components/admin/CompanySameBrandSeriesSection";

describe("CompanySameBrandSeriesSection", () => {
  it("shows empty copy when no same-brand Event Series is linked", () => {
    const html = renderToStaticMarkup(
      <CompanySameBrandSeriesSection series={null} />,
    );
    assert.match(html, /Same-brand Event Series/);
    assert.match(html, /No same-brand Event Series linked/);
    assert.match(html, /not organizer, owner,\s*or operator/i);
    assert.doesNotMatch(html, /Manage link/);
  });

  it("renders the linked Event Series with an admin manage link", () => {
    const html = renderToStaticMarkup(
      <CompanySameBrandSeriesSection
        series={{
          id: "series-1",
          name: "TOKEN2049",
          slug: "token2049",
        }}
      />,
    );
    assert.match(html, /TOKEN2049/);
    assert.match(html, /token2049/);
    assert.match(html, /href="\/admin\/events\/series\/series-1"/);
    assert.match(html, /Manage link/);
    assert.match(html, /same brand/i);
  });
});
