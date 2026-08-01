import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const APPROVE_ROUTE =
  "src/app/api/admin/companies/[id]/event-brand-public-profile/approve/route.ts";
const REVOKE_ROUTE =
  "src/app/api/admin/companies/[id]/event-brand-public-profile/revoke/route.ts";
const SERIES_ROUTE = "src/app/api/admin/event-series/[id]/route.ts";
const COMPANY_PAGE = "src/app/admin/companies/[id]/page.tsx";
const SECTION =
  "src/features/companies/components/admin/CompanyEventBrandPublicProfileSection.tsx";
const SAME_BRAND_SECTION =
  "src/features/events/components/admin/SameBrandCompanyProfileSection.tsx";

describe("Event Brand public profile Admin wiring (ADR-005 EB0)", () => {
  it("exposes approve and revoke Admin API routes", () => {
    const approve = readFileSync(APPROVE_ROUTE, "utf8");
    const revoke = readFileSync(REVOKE_ROUTE, "utf8");
    assert.match(approve, /approveEventBrandPublicProfileAdmin/);
    assert.match(revoke, /revokeEventBrandPublicProfileAdmin/);
    assert.match(approve, /requireAdminApi/);
    assert.match(revoke, /requireAdminApi/);
  });

  it("Company Admin page mounts the approval section with company approval state", () => {
    const page = readFileSync(COMPANY_PAGE, "utf8");
    assert.match(page, /CompanyEventBrandPublicProfileSection/);
    assert.match(page, /event_brand_public_profile_approved_at/);
    assert.match(page, /sameBrandSeries/);
  });

  it("Admin copy states routing-only impact (not role data)", () => {
    const section = readFileSync(SECTION, "utf8");
    assert.match(section, /public profile destination/);
    assert.match(section, /does[\s\S]*not[\s\S]*change Sponsor, Organizer/);
    assert.match(section, /event-brand-public-profile\/\$\{action\}/);
  });

  it("Series same-brand PATCH validates currently linked approval before unlink", () => {
    const route = readFileSync(SERIES_ROUTE, "utf8");
    assert.match(route, /currentlyLinkedCompanyApprovedAt/);
    assert.match(route, /currentlyLinkedCompanyId/);
  });

  it("Series Admin UI disables unlink while public-profile approval is active", () => {
    const source = readFileSync(SAME_BRAND_SECTION, "utf8");
    assert.match(source, /isEventBrandPublicProfileApproved/);
    assert.match(source, /publicProfileApproved/);
    assert.match(source, /disabled=\{saving \|\| isMergedSeries \|\| publicProfileApproved\}/);
  });
});
