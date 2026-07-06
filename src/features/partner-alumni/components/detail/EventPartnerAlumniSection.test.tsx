import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { EventPartnerAlumniSection } from "@/src/features/partner-alumni/components/detail/EventPartnerAlumniSection";

describe("EventPartnerAlumniSection", () => {
  it("renders recognition metadata and company list", () => {
    const html = renderToStaticMarkup(
      <EventPartnerAlumniSection
        seriesName="Demo Series"
        partnerAlumni={{
          recognition_label: "Our Partners Over The Years",
          primary_source_url: "https://example.com/partners",
          source_checked_at: "2026-07-01T12:00:00.000Z",
          members: [
            {
              id: "m1",
              display_order: 1,
              company: {
                id: "11111111-1111-1111-1111-111111111111",
                name: "Acme Corp",
                slug: "acme-corp",
                logo_url: null,
                logo_source: null,
                logo_status: null,
              },
            },
          ],
        }}
      />,
    );

    assert.match(html, /Partner Alumni/);
    assert.match(html, /Our Partners Over The Years/);
    assert.match(html, /Source checked/);
    assert.match(html, /July 2026/);
    assert.match(html, /example\.com/);
    assert.match(html, /Acme Corp/);
    assert.match(html, /Demo Series/);
  });
});
