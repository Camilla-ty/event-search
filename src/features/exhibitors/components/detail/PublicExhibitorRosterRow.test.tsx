import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PublicExhibitorRosterRow } from "@/src/features/exhibitors/components/detail/PublicExhibitorRosterRow";
import type { PublicExhibitorRow } from "@/src/features/exhibitors/server/exhibitorsPublic";
import { RESTRICTED_COMPANY_ROSTER_LABEL } from "@/src/lib/companies/companyPublicRestriction";
import { buildSponsorProfilePath } from "@/src/lib/routes/explorerUrls";

function renderRow(exhibitor: PublicExhibitorRow): string {
  return renderToStaticMarkup(
    <ul>
      <PublicExhibitorRosterRow exhibitor={exhibitor} />
    </ul>,
  );
}

describe("PublicExhibitorRosterRow", () => {
  it("makes the whole row a single company-profile link with domain as text", () => {
    const company = {
      id: "11111111-1111-1111-1111-111111111111",
      slug: "acme-corp",
      name: "Acme Corp",
      domain: "acme.com",
      website: "https://acme.com",
      restricted_at: null,
      logo_url: null,
      logo_source: null,
      logo_status: null,
    };
    const expectedProfileHref = buildSponsorProfilePath(company);
    assert.equal(expectedProfileHref, "/sponsors/acme-corp");

    const html = renderRow({
      id: "exhibitor-1",
      company_id: company.id,
      tier_rank: 1,
      tier_label: "Gold",
      display_order: 1,
      company,
    });

    assert.match(html, /Acme Corp/);
    assert.match(html, /acme\.com/);
    assert.match(
      html,
      new RegExp(
        `href="${expectedProfileHref!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>[\\s\\S]*Acme Corp[\\s\\S]*acme\\.com`,
      ),
    );
    assert.doesNotMatch(html, /href="https:\/\/acme\.com/);
    assert.doesNotMatch(html, /rel="noopener noreferrer"/);
    assert.match(html, />A</);
    assert.equal((html.match(/<a\b/g) ?? []).length, 1);
  });

  it("falls back to company id in the sponsor profile path when slug is missing", () => {
    const company = {
      id: "11111111-1111-1111-1111-111111111111",
      slug: null,
      name: "Acme Corp",
      domain: "acme.com",
      website: null,
      restricted_at: null,
      logo_url: null,
      logo_source: null,
      logo_status: null,
    };
    const expectedProfileHref = buildSponsorProfilePath(company);
    assert.equal(expectedProfileHref, `/sponsors/${company.id}`);

    const html = renderRow({
      id: "exhibitor-1b",
      company_id: company.id,
      tier_rank: 1,
      tier_label: null,
      display_order: 1,
      company,
    });

    assert.match(
      html,
      new RegExp(
        `href="${expectedProfileHref!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>[\\s\\S]*Acme Corp`,
      ),
    );
    assert.doesNotMatch(html, /href="\/exhibitors\//);
  });

  it("scrubs restricted companies like sponsors", () => {
    const html = renderRow({
      id: "exhibitor-3",
      company_id: "22222222-2222-2222-2222-222222222222",
      tier_rank: 1,
      tier_label: null,
      display_order: 1,
      company: {
        id: "22222222-2222-2222-2222-222222222222",
        slug: "restricted-co",
        name: "Restricted Co",
        domain: "restricted.example",
        website: "https://restricted.example",
        restricted_at: "2026-07-11T00:00:00.000Z",
        logo_url: "https://example.com/logo.png",
        logo_source: "manual",
        logo_status: "ok",
      },
    });

    assert.match(html, /Restricted Co/);
    assert.match(html, new RegExp(RESTRICTED_COMPANY_ROSTER_LABEL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(html, />R</);
    assert.doesNotMatch(html, /href="\/sponsors\//);
    assert.doesNotMatch(html, /restricted\.example/);
    assert.doesNotMatch(html, /href="https:\/\/restricted\.example/);
    assert.doesNotMatch(html, /<img\b/);
    assert.doesNotMatch(html, /<a\b/);
  });
});
