import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { DiscoverHero } from "@/src/features/home/components/DiscoverHero";
import { BRAND_NAME } from "@/src/lib/design/brand";

describe("DiscoverHero", () => {
  it("keeps the hero layout and uses reviewed coverage copy", () => {
    const html = renderToStaticMarkup(<DiscoverHero />);

    assert.match(html, /space-y-2 border-b border-slate-200 pb-6/);
    assert.match(html, new RegExp(BRAND_NAME));
    assert.match(
      html,
      /Event industry intelligence — browse upcoming events and recently\s+reviewed event coverage\./,
    );
    assert.equal(html.includes("coverage added"), false);
  });
});
