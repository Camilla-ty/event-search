import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

const pagePath = join(process.cwd(), "src/app/(marketing)/page.tsx");

describe("Discover page Recently Reviewed module", () => {
  it("hides the header View all and wires the reviewed footer CTA", () => {
    const source = readFileSync(pagePath, "utf8");

    assert.match(source, /title="Recently Reviewed Events"/);
    assert.match(source, /showHeaderViewAll=\{false\}/);
    assert.match(source, /footerHref=\{recentlyReviewedViewAllHref\}/);
    assert.match(source, /footerLabel="Browse all recently reviewed events"/);
    assert.match(source, /buildEventExplorerRecentlyReviewedUrl/);
    assert.doesNotMatch(
      source,
      /title="Recently Reviewed Events"[\s\S]*?showHeaderViewAll=\{true\}/,
    );
  });
});
