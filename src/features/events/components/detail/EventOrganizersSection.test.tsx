import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { EventOrganizersSection } from "@/src/features/events/components/detail/EventOrganizersSection";

describe("EventOrganizersSection", () => {
  it("renders empty state when no organizers", () => {
    const html = renderToStaticMarkup(<EventOrganizersSection organizers={[]} />);
    assert.match(html, /<h2[^>]*>Organizers<\/h2>/);
    assert.match(html, /No organizers are listed for this edition yet/);
  });

  it("renders organizer list when links exist", () => {
    const html = renderToStaticMarkup(
      <EventOrganizersSection
        organizers={[
          {
            id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            role_label: "Host",
            display_order: 1,
            company: {
              id: "11111111-1111-1111-1111-111111111111",
              name: "Acme Events",
              slug: "acme-events",
              logo_url: null,
              logo_source: null,
              logo_status: null,
            },
          },
        ]}
      />,
    );
    assert.match(html, /Acme Events/);
    assert.match(html, /Host/);
  });
});
