import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  SameBrandCompanyProfileSectionHeader,
  buildSameBrandSectionSummary,
} from "@/src/features/events/components/admin/SameBrandCompanyProfileSection";
import type { SameBrandCompanyProfileSummary } from "@/src/features/events/server/eventSeriesAdmin";

const sectionPath = join(
  process.cwd(),
  "src/features/events/components/admin/SameBrandCompanyProfileSection.tsx",
);

const ACTIVE_COMPANY: SameBrandCompanyProfileSummary = {
  id: "f85bff6d-f25a-40c5-839f-4a395fbb3d37",
  name: "Singapore FinTech Festival",
  slug: "singapore-fintech-festival",
  domain: "fintechfestival.sg",
  status: "active",
  merged_into_company_id: null,
  restricted_at: null,
  event_brand_public_profile_approved_at: null,
};

describe("buildSameBrandSectionSummary", () => {
  it("labels unlinked Series as Not linked with no chips", () => {
    assert.deepEqual(
      buildSameBrandSectionSummary({
        linkedCompanyId: null,
        linkedCompany: null,
      }),
      { statusLabel: "Not linked", chips: [] },
    );
  });

  it("labels linked Series with company name", () => {
    assert.deepEqual(
      buildSameBrandSectionSummary({
        linkedCompanyId: ACTIVE_COMPANY.id,
        linkedCompany: ACTIVE_COMPANY,
      }),
      { statusLabel: "Linked: Singapore FinTech Festival", chips: [] },
    );
  });

  it("includes Approved, Stale, and Restricted chips when applicable", () => {
    assert.deepEqual(
      buildSameBrandSectionSummary({
        linkedCompanyId: ACTIVE_COMPANY.id,
        linkedCompany: {
          ...ACTIVE_COMPANY,
          restricted_at: "2026-07-11T00:00:00.000Z",
          event_brand_public_profile_approved_at: "2026-08-01T11:19:34.191394+00",
          status: "inactive",
        },
      }),
      {
        statusLabel: "Linked: Singapore FinTech Festival",
        chips: ["Approved", "Stale", "Restricted"],
      },
    );
  });
});

describe("SameBrandCompanyProfileSection wiring (SB1/SB3)", () => {
  const source = readFileSync(sectionPath, "utf8");

  it("supports link, replace, unlink, and stale-link messaging", () => {
    assert.match(source, /Same-brand company profile/);
    assert.match(source, /not an organizer, owner, or operator/i);
    assert.match(source, /persistCompanyProfileId\(selectedCompany\.id,\s*action\)/);
    assert.match(source, /persistCompanyProfileId\(null,\s*"unlink"\)/);
    assert.match(source, /SAME_BRAND_STALE_LINK_MESSAGE/);
    assert.match(source, /isSameBrandCompanyProfileStale/);
    assert.match(source, /This event series is merged/);
    assert.match(source, /company_profile_id:\s*nextId/);
  });

  it("surfaces Event Brand public-profile unlink lock (ADR-005 EB0)", () => {
    assert.match(source, /isEventBrandPublicProfileApproved/);
    assert.match(source, /Event Brand public-profile approval is active/);
    assert.match(source, /future public routing only/);
  });

  it("collapses by default and only expands when the admin chooses", () => {
    assert.match(source, /const \[expanded, setExpanded\] = useState\(false\)/);
    assert.match(source, /SameBrandCompanyProfileSectionHeader/);
    assert.match(source, /setExpanded\(\(current\) => !current\)/);
    assert.match(source, /\{expanded \? \(/);
    assert.match(source, /buildSameBrandSectionSummary/);
  });
});

describe("SameBrandCompanyProfileSectionHeader collapsed chrome", () => {
  it("shows Not linked summary when collapsed", () => {
    const html = renderToStaticMarkup(
      <SameBrandCompanyProfileSectionHeader
        summary={buildSameBrandSectionSummary({
          linkedCompanyId: null,
          linkedCompany: null,
        })}
        expanded={false}
        onToggle={() => {}}
      />,
    );

    assert.match(html, /Same-brand company profile/);
    assert.match(html, /Not linked/);
    assert.match(html, /aria-expanded="false"/);
    assert.match(html, />Show</);
  });

  it("shows Linked status and chips while collapsed", () => {
    const html = renderToStaticMarkup(
      <SameBrandCompanyProfileSectionHeader
        summary={buildSameBrandSectionSummary({
          linkedCompanyId: ACTIVE_COMPANY.id,
          linkedCompany: {
            ...ACTIVE_COMPANY,
            restricted_at: "2026-07-11T00:00:00.000Z",
            event_brand_public_profile_approved_at: "2026-08-01T11:19:34.191394+00",
          },
        })}
        expanded={false}
        onToggle={() => {}}
      />,
    );

    assert.match(html, /Linked: Singapore FinTech Festival/);
    assert.match(html, />Approved</);
    assert.match(html, />Restricted</);
    assert.match(html, /aria-expanded="false"/);
    assert.match(html, />Show</);
  });
});
