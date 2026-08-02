import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  assemblePublicPartnerAlumniCurrentVersion,
  mapPublicPartnerAlumniMemberRows,
  mapPublicPartnerAlumniMembers,
  shouldShowPublicPartnerAlumniTab,
  type PublicPartnerAlumniMemberRow,
} from "@/src/features/partner-alumni/server/partnerAlumniPublic";
import { isCompanyRestricted } from "@/src/lib/companies/companyPublicRestriction";

const sourcePath = join(
  process.cwd(),
  "src/features/partner-alumni/server/partnerAlumniPublic.ts",
);
const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260802150000_event_partner_alumni_public_reads.sql",
);
const pagePath = join(
  process.cwd(),
  "src/app/(marketing)/events/[id]/page.tsx",
);

describe("partnerAlumniPublic wiring (ARC-001 Phase 5)", () => {
  it("public loaders no longer use createAdminClient", () => {
    const source = readFileSync(sourcePath, "utf8");
    assert.match(source, /createClient/);
    assert.match(source, /event_partner_alumni_public_versions/);
    assert.match(source, /event_partner_alumni_public_members/);
    assert.doesNotMatch(source, /createAdminClient/);
    assert.doesNotMatch(source, /from "@\/src\/lib\/supabase\/admin"/);
    assert.doesNotMatch(source, /\.from\("event_partner_alumni"\)/);
    assert.doesNotMatch(source, /\.from\("event_partner_alumni_versions"\)/);
    assert.doesNotMatch(source, /\.from\("event_partner_alumni_version_companies"\)/);
  });

  it("event detail page still uses the public Partner Alumni loader", () => {
    const source = readFileSync(pagePath, "utf8");
    assert.match(source, /getPublicPartnerAlumniForSeriesId/);
    assert.match(source, /shouldShowPublicPartnerAlumniTab/);
  });

  it("migration exposes only published current-version aggregates with SELECT grants", () => {
    const sql = readFileSync(migrationPath, "utf8");
    assert.match(sql, /event_partner_alumni_public_versions/);
    assert.match(sql, /event_partner_alumni_public_members/);
    assert.match(sql, /security_invoker\s*=\s*false/i);
    assert.match(sql, /current_version_id IS NOT NULL/);
    assert.match(
      sql,
      /REVOKE ALL ON public\.event_partner_alumni_public_versions FROM PUBLIC, anon, authenticated/,
    );
    assert.match(
      sql,
      /GRANT SELECT ON public\.event_partner_alumni_public_versions TO anon, authenticated/,
    );
    assert.match(
      sql,
      /REVOKE ALL ON public\.event_partner_alumni_public_members FROM PUBLIC, anon, authenticated/,
    );
    assert.match(
      sql,
      /GRANT SELECT ON public\.event_partner_alumni_public_members TO anon, authenticated/,
    );
    assert.doesNotMatch(sql, /GRANT SELECT ON TABLE public\.event_partner_alumni /);
    assert.doesNotMatch(
      sql,
      /GRANT SELECT ON TABLE public\.event_partner_alumni_versions /,
    );
  });
});

describe("mapPublicPartnerAlumniMembers", () => {
  it("maps and sorts members by display_order then id", () => {
    const members = mapPublicPartnerAlumniMembers([
      {
        id: "b-member",
        display_order: 2,
        companies: { id: "c2", name: "Beta", slug: "beta" },
      },
      {
        id: "a-member",
        display_order: 1,
        companies: { id: "c1", name: "Alpha", slug: "alpha" },
      },
    ]);

    assert.equal(members.length, 2);
    assert.equal(members[0]?.id, "a-member");
    assert.equal(members[0]?.company?.name, "Alpha");
    assert.equal(members[1]?.id, "b-member");
  });

  it("skips rows without id", () => {
    const members = mapPublicPartnerAlumniMembers([
      { display_order: 1, companies: { id: "c1", name: "Alpha" } },
    ]);
    assert.equal(members.length, 0);
  });
});

describe("mapPublicPartnerAlumniMemberRows / assemblePublicPartnerAlumniCurrentVersion", () => {
  const version = {
    event_series_id: "series-1",
    recognition_label: "Partners",
    primary_source_url: "https://example.com/pa",
    source_checked_at: "2026-07-01T00:00:00.000Z",
  };

  const memberRows: PublicPartnerAlumniMemberRow[] = [
    {
      event_series_id: "series-1",
      member_id: "m2",
      display_order: 2,
      company_id: "c2",
      company_name: "Beta",
      company_slug: "beta",
      company_restricted_at: null,
    },
    {
      event_series_id: "series-1",
      member_id: "m1",
      display_order: 1,
      company_id: "c1",
      company_name: "Alpha",
      company_slug: "alpha",
      company_restricted_at: null,
    },
  ];

  it("returns only the assembled published version shape in display order", () => {
    const result = assemblePublicPartnerAlumniCurrentVersion(
      version,
      memberRows,
      (company) => ({ ...company, public_href: `/sponsors/${company.slug}` }),
    );

    assert.ok(result);
    assert.equal(result.recognition_label, "Partners");
    assert.equal(result.primary_source_url, "https://example.com/pa");
    assert.equal(result.source_checked_at, "2026-07-01T00:00:00.000Z");
    assert.deepEqual(
      result.members.map((member) => ({
        id: member.id,
        display_order: member.display_order,
        company_id: member.company?.id,
        public_href: member.company?.public_href,
      })),
      [
        {
          id: "m1",
          display_order: 1,
          company_id: "c1",
          public_href: "/sponsors/alpha",
        },
        {
          id: "m2",
          display_order: 2,
          company_id: "c2",
          public_href: "/sponsors/beta",
        },
      ],
    );
    assert.equal("version_id" in result, false);
    assert.equal("current_version_id" in result, false);
  });

  it("returns null for missing version or empty member sets (hide-when-empty)", () => {
    assert.equal(
      assemblePublicPartnerAlumniCurrentVersion(null, memberRows, (c) => c),
      null,
    );
    assert.equal(
      assemblePublicPartnerAlumniCurrentVersion(version, [], (c) => c),
      null,
    );
    assert.equal(shouldShowPublicPartnerAlumniTab(null), false);
  });

  it("keeps restricted companies visible but marked for app-level masking", () => {
    const restrictedRows: PublicPartnerAlumniMemberRow[] = [
      {
        member_id: "m-r",
        display_order: 1,
        company_id: "c-r",
        company_name: "Restricted Co",
        company_slug: "restricted-co",
        company_restricted_at: "2026-07-11T00:00:00.000Z",
      },
    ];

    const members = mapPublicPartnerAlumniMemberRows(restrictedRows);
    assert.equal(members.length, 1);
    assert.equal(members[0]?.company?.name, "Restricted Co");
    assert.ok(members[0]?.company && isCompanyRestricted(members[0].company));

    const assembled = assemblePublicPartnerAlumniCurrentVersion(
      version,
      restrictedRows,
      (company) =>
        isCompanyRestricted(company)
          ? { ...company, public_href: null }
          : { ...company, public_href: `/sponsors/${company.slug}` },
    );
    assert.ok(assembled);
    assert.equal(assembled.members[0]?.company?.public_href, null);
    assert.equal(shouldShowPublicPartnerAlumniTab(assembled), true);
  });

  it("does not invent draft/historical versions when version row is absent", () => {
    // Public views only contain current_version_id rows; no version ⇒ no public PA.
    assert.equal(
      assemblePublicPartnerAlumniCurrentVersion(
        undefined,
        [
          {
            member_id: "draft-m1",
            display_order: 1,
            company_id: "c1",
            company_name: "Should not publish",
          },
        ],
        (c) => c,
      ),
      null,
    );
  });
});

describe("shouldShowPublicPartnerAlumniTab", () => {
  it("returns false when current version is null", () => {
    assert.equal(shouldShowPublicPartnerAlumniTab(null), false);
  });

  it("returns false when current version has no companies", () => {
    assert.equal(
      shouldShowPublicPartnerAlumniTab({
        recognition_label: "Partners",
        primary_source_url: null,
        source_checked_at: "2026-07-01T00:00:00.000Z",
        members: [],
      }),
      false,
    );
  });

  it("returns true when current version has at least one company", () => {
    assert.equal(
      shouldShowPublicPartnerAlumniTab({
        recognition_label: "Partners",
        primary_source_url: null,
        source_checked_at: "2026-07-01T00:00:00.000Z",
        members: [
          {
            id: "m1",
            display_order: 1,
            company: { id: "c1", name: "Acme" },
          },
        ],
      }),
      true,
    );
  });
});

describe("getPublicPartnerAlumniForSeriesId", () => {
  it("returns null for blank series id without throwing", async () => {
    const { getPublicPartnerAlumniForSeriesId } = await import(
      "@/src/features/partner-alumni/server/partnerAlumniPublic"
    );
    assert.equal(await getPublicPartnerAlumniForSeriesId(""), null);
    assert.equal(await getPublicPartnerAlumniForSeriesId("   "), null);
  });
});
