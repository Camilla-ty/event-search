import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CompanyExhibitorsTable } from "@/src/features/companies/components/admin/CompanyExhibitorsTable";
import { CompanyPartnerAlumniTable } from "@/src/features/companies/components/admin/CompanyPartnerAlumniTable";
import { CompanySponsorshipsTable } from "@/src/features/companies/components/admin/CompanySponsorshipsTable";
import {
  exhibitorEditionAdminHref,
  eventSeriesAdminHref,
  mapExhibitorAdminRows,
} from "@/src/features/companies/server/companyExhibitorAdmin";
import { buildPartnerAlumniRows } from "@/src/features/companies/server/companyPartnerAlumniAdmin";

const INBTC = "fa0b31d6-7414-46eb-a10e-b872ce9ed4b1";
const OTHER_COMPANY = "11111111-1111-4111-8111-111111111111";
const EDITION_2021 = "0301a714-7eb5-46c3-afa4-e03ee9fa1a5e";
const EDITION_2022 = "2bb5b2df-b057-4106-962f-299cb2f5ccb3";
const SERIES_ID = "848cd580-4201-4a81-ace9-c8768e0e0d7b";
const ROW_2021 = "cbe5581a-8a10-4285-980b-77b71921567c";
const ROW_2022 = "74cda407-ebc2-4d2f-acd4-20d7b26dc25a";

function exhibitorRaw(
  id: string,
  companyId: string,
  edition: { id: string; name: string; year: number },
) {
  return {
    id,
    company_id: companyId,
    tier_rank: 1,
    tier_label: "Exhibitors",
    event_editions: {
      id: edition.id,
      name: edition.name,
      year: edition.year,
      slug: edition.name.toLowerCase().replaceAll(" ", "-"),
      event_series: { id: SERIES_ID, name: "Mining Disrupt" },
    },
  };
}

const inbtcRows = [
  exhibitorRaw(ROW_2022, INBTC, {
    id: EDITION_2022,
    name: "Mining Disrupt Miami 2022",
    year: 2022,
  }),
  exhibitorRaw(ROW_2021, INBTC, {
    id: EDITION_2021,
    name: "Mining Disrupt Miami 2021",
    year: 2021,
  }),
];

describe("company exhibitor relationships", () => {
  it("shows both INBTC Mining Disrupt editions for the same company", () => {
    const rows = mapExhibitorAdminRows(INBTC, inbtcRows);

    assert.deepEqual(
      rows.map((row) => row.edition?.name),
      ["Mining Disrupt Miami 2021", "Mining Disrupt Miami 2022"],
    );
    assert.equal(rows[0]?.tier_label, "Exhibitors");
    assert.equal(rows[0]?.series?.name, "Mining Disrupt");
    assert.equal(rows[1]?.series?.id, SERIES_ID);
  });

  it("shows an exhibitor-only company", () => {
    const rows = mapExhibitorAdminRows(INBTC, [inbtcRows[1]!]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.edition?.id, EDITION_2021);
  });

  it("drops rows for a different company id", () => {
    const rows = mapExhibitorAdminRows(INBTC, [
      ...inbtcRows,
      exhibitorRaw("other-row", OTHER_COMPANY, {
        id: "edition-other",
        name: "Other Expo",
        year: 2020,
      }),
    ]);
    assert.deepEqual(
      rows.map((row) => row.id),
      [ROW_2021, ROW_2022],
    );
  });

  it("keeps a relationship past the first 1,000 rows", () => {
    const filler = Array.from({ length: 1000 }, (_, index) =>
      exhibitorRaw(`filler-${index}`, INBTC, {
        id: `edition-filler-${index}`,
        name: `Filler ${index}`,
        year: 2000,
      }),
    );
    const rows = mapExhibitorAdminRows(INBTC, [...filler, inbtcRows[1]!]);
    assert.equal(rows.length, 1001);
    assert.equal(rows.at(-1)?.id, ROW_2021);
  });

  it("renders edition and series links, and an empty state", () => {
    const rows = mapExhibitorAdminRows(INBTC, inbtcRows);
    const html = renderToStaticMarkup(
      React.createElement(CompanyExhibitorsTable, { exhibitors: rows }),
    );
    assert.ok(html.includes(exhibitorEditionAdminHref(EDITION_2021)));
    assert.ok(html.includes(eventSeriesAdminHref(SERIES_ID)));
    assert.match(html, /Mining Disrupt Miami 2021 \(2021\)/);
    assert.match(html, /Mining Disrupt Miami 2022 \(2022\)/);

    const empty = renderToStaticMarkup(
      React.createElement(CompanyExhibitorsTable, { exhibitors: [] }),
    );
    assert.match(empty, /not an exhibitor of any event edition yet/);
  });

  it("can show the same edition as a sponsorship and an exhibitor", () => {
    const exhibitors = mapExhibitorAdminRows(INBTC, [inbtcRows[1]!]);
    const html = renderToStaticMarkup(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(CompanySponsorshipsTable, {
          sponsorships: [
            {
              id: "sponsor-row",
              tier_rank: 1,
              tier_label: "Gold",
              edition: {
                id: EDITION_2021,
                name: "Mining Disrupt Miami 2021",
                year: 2021,
                slug: "mining-disrupt-miami-2021",
              },
              series: { id: SERIES_ID, name: "Mining Disrupt" },
            },
          ],
        }),
        React.createElement(CompanyExhibitorsTable, { exhibitors }),
      ),
    );
    assert.match(html, /tab=sponsors/);
    assert.ok(html.includes(exhibitorEditionAdminHref(EDITION_2021)));
    assert.equal((html.match(/Mining Disrupt Miami 2021/g) ?? []).length, 2);
  });
});

describe("company partner alumni relationships", () => {
  const currentVersion = "version-current";
  const program = {
    id: "program-nft",
    event_series_id: SERIES_ID,
    current_version_id: currentVersion,
  };
  const members = [
    { company_id: INBTC, event_partner_alumni_version_id: currentVersion },
    { company_id: INBTC, event_partner_alumni_version_id: "version-old" },
    { company_id: OTHER_COMPANY, event_partner_alumni_version_id: currentVersion },
  ];
  const series = [{ id: SERIES_ID, name: "Mining Disrupt" }];

  it("lists every edition of the current series and ignores an older version", () => {
    const rows = buildPartnerAlumniRows({
      companyId: INBTC,
      members,
      programs: [program],
      series,
      editions: [
        {
          id: EDITION_2022,
          name: "Mining Disrupt Miami 2022",
          year: 2022,
          slug: "mining-disrupt-miami-2022",
          series_id: SERIES_ID,
        },
        {
          id: EDITION_2021,
          name: "Mining Disrupt Miami 2021",
          year: 2021,
          slug: "mining-disrupt-miami-2021",
          series_id: SERIES_ID,
        },
      ],
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.series?.id, SERIES_ID);
    assert.deepEqual(
      rows[0]?.editions.map((edition) => edition.year),
      [2021, 2022],
    );
  });

  it("does not invent an edition when the series has none", () => {
    const rows = buildPartnerAlumniRows({
      companyId: INBTC,
      members: [{ company_id: INBTC, event_partner_alumni_version_id: currentVersion }],
      programs: [program],
      series,
      editions: [],
    });
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0]?.editions, []);

    const html = renderToStaticMarkup(
      React.createElement(CompanyPartnerAlumniTable, { partnerAlumni: rows }),
    );
    assert.ok(html.includes(eventSeriesAdminHref(SERIES_ID)));
    assert.match(html, /No event editions/);
    assert.doesNotMatch(html, /admin\/events\/editions\//);
  });

  it("shows an empty state when the company has no current roster", () => {
    const rows = buildPartnerAlumniRows({
      companyId: INBTC,
      members: [],
      programs: [program],
      series,
      editions: [],
    });
    assert.deepEqual(rows, []);
    const html = renderToStaticMarkup(
      React.createElement(CompanyPartnerAlumniTable, { partnerAlumni: rows }),
    );
    assert.match(html, /not on a current Partner Alumni roster/);
  });
});

describe("company detail page sections", () => {
  it("adds exhibitors and partner alumni without removing the existing sections", () => {
    const page = readFileSync(
      new URL("../../../app/admin/companies/[id]/page.tsx", import.meta.url),
      "utf8",
    );
    assert.match(page, /export const dynamic = "force-dynamic"/);
    assert.match(page, /listSponsorshipsForCompanyAdmin\(id\)/);
    assert.match(page, /listExhibitorsForCompanyAdmin\(id\)/);
    assert.match(page, /listOrganizerRolesForCompanyAdmin\(id\)/);
    assert.match(page, /listPartnerAlumniForCompanyAdmin\(id\)/);
    assert.match(page, /CompanySameBrandSeriesSection/);
    assert.match(page, /CompanyEventBrandPublicProfileSection/);
    assert.match(page, /CompanyPublicVisibilitySection/);
    assert.match(page, /Sponsorships \(/);
    assert.match(page, /Organizer roles \(/);

    const exhibitors = readFileSync(
      new URL("./companyExhibitorAdmin.ts", import.meta.url),
      "utf8",
    );
    assert.match(exhibitors, /from\("event_exhibitors"\)/);
    assert.match(exhibitors, /\.eq\("company_id", companyId\)/);
    assert.match(exhibitors, /fetchAllPaginatedSupabaseRows/);

    const alumni = readFileSync(
      new URL("./companyPartnerAlumniAdmin.ts", import.meta.url),
      "utf8",
    );
    assert.match(alumni, /from\("event_partner_alumni_version_companies"\)/);
    assert.match(alumni, /\.eq\("company_id", companyId\)/);
    assert.match(alumni, /current_version_id/);
    assert.doesNotMatch(exhibitors, /countEventLinksByCompany/);
    assert.doesNotMatch(alumni, /countEventLinksByCompany/);
  });
});
