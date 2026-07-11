import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PublicSponsorRosterRow } from "@/src/features/events/components/detail/PublicSponsorRosterRow";
import { RESTRICTED_COMPANY_PUBLIC_MESSAGE } from "@/src/lib/companies/companyPublicRestriction";

import type { EventSponsorRow } from "./types";

function renderRow(sponsor: EventSponsorRow): string {
  return renderToStaticMarkup(
    <ul>
      <PublicSponsorRosterRow sponsor={sponsor} />
    </ul>,
  );
}

describe("PublicSponsorRosterRow", () => {
  it("renders unrestricted sponsors with logo, name, domain, and profile link", () => {
    const html = renderRow({
      id: "sponsor-1",
      company_id: "11111111-1111-1111-1111-111111111111",
      companies: {
        id: "11111111-1111-1111-1111-111111111111",
        slug: "acme-corp",
        name: "Acme Corp",
        domain: "acme.com",
        restricted_at: null,
        logo_url: null,
        logo_source: null,
        logo_status: null,
      },
    });

    assert.match(html, /Acme Corp/);
    assert.match(html, /acme\.com/);
    assert.match(html, /href="\/sponsors\/acme-corp"/);
    assert.match(html, />A</);
    assert.doesNotMatch(html, new RegExp(RESTRICTED_COMPANY_PUBLIC_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });

  it("renders restricted sponsors with name and policy message only", () => {
    const html = renderRow({
      id: "sponsor-2",
      company_id: "22222222-2222-2222-2222-222222222222",
      companies: {
        id: "22222222-2222-2222-2222-222222222222",
        slug: "restricted-co",
        name: "Restricted Co",
        domain: "restricted.example",
        restricted_at: "2026-07-11T00:00:00.000Z",
        logo_url: "https://example.com/logo.png",
        logo_source: "manual",
        logo_status: "ok",
      },
    });

    assert.match(html, /Restricted Co/);
    assert.match(html, /not publicly displayed in accordance with EventPixels/);
    assert.match(html, /content policy/);
    assert.doesNotMatch(html, /href="\/sponsors\//);
    assert.doesNotMatch(html, /restricted\.example/);
    assert.doesNotMatch(html, /<img\b/);
  });
});
