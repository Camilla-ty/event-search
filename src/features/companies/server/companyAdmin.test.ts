import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  fetchAllPaginatedSupabaseRows,
  SUPABASE_DEFAULT_PAGE_SIZE,
} from "@/src/lib/supabase/fetchAllPaginatedRows";

import { countEventLinksByCompany, countSponsorLinksByCompany, currentPartnerAlumniSeriesLinks } from "./companyAdmin";

const FORESIGHT_ID = "11476ae5-cc8a-4288-bd4e-412de9c3ec1b";

function fillerSponsorLink(index: number) {
  return { company_id: `filler-company-${index}` };
}

describe("countSponsorLinksByCompany pagination regressions", () => {
  it("counts sponsor links beyond the first 1,000 event_sponsors rows", async () => {
    const allLinks = [
      ...Array.from({ length: SUPABASE_DEFAULT_PAGE_SIZE }, (_, index) =>
        fillerSponsorLink(index),
      ),
      { company_id: FORESIGHT_ID },
      { company_id: FORESIGHT_ID },
      { company_id: FORESIGHT_ID },
    ];

    const truncated = countSponsorLinksByCompany(allLinks.slice(0, SUPABASE_DEFAULT_PAGE_SIZE));
    const full = countSponsorLinksByCompany(allLinks);

    assert.equal(truncated.get(FORESIGHT_ID) ?? 0, 0);
    assert.equal(full.get(FORESIGHT_ID), 3);
  });

  it("loads all event_sponsors pages before aggregating counts", async () => {
    const allLinks = Array.from({ length: 1001 }, (_, index) => ({
      company_id: index < 1000 ? `filler-${index}` : FORESIGHT_ID,
    }));

    const loaded = await fetchAllPaginatedSupabaseRows(async ({ from, to }) => ({
      data: allLinks.slice(from, to + 1),
      error: null,
    }));

    const counts = countSponsorLinksByCompany(loaded);
    assert.equal(loaded.length, 1001);
    assert.equal(counts.get(FORESIGHT_ID), 1);
  });
});

const SPONSOR = "company-sponsor";
const EXHIBITOR = "company-exhibitor";
const ORGANIZER = "company-organizer";
const ALUMNI = "company-alumni";
const MULTI_ROLE = "company-multi-role";
const MULTI_EDITION = "company-multi-edition";
const UNLINKED = "company-unlinked";
const EDITION_A = "edition-a";
const EDITION_B = "edition-b";
const SERIES = "series-nft";

const ONE_SERIES_EDITION = [{ id: EDITION_A, series_id: SERIES }];

describe("countEventLinksByCompany", () => {
  it("counts a sponsor-only company", () => {
    const counts = countEventLinksByCompany({
      editionLinks: [{ company_id: SPONSOR, event_edition_id: EDITION_A }],
      partnerAlumniSeriesLinks: [],
      editions: ONE_SERIES_EDITION,
    });
    assert.equal(counts.get(SPONSOR), 1);
  });

  it("counts an exhibitor-only company", () => {
    const counts = countEventLinksByCompany({
      editionLinks: [{ company_id: EXHIBITOR, event_edition_id: EDITION_A }],
      partnerAlumniSeriesLinks: [],
      editions: ONE_SERIES_EDITION,
    });
    assert.equal(counts.get(EXHIBITOR), 1);
  });

  it("counts an organizer-only company", () => {
    const counts = countEventLinksByCompany({
      editionLinks: [{ company_id: ORGANIZER, event_edition_id: EDITION_A }],
      partnerAlumniSeriesLinks: [],
      editions: ONE_SERIES_EDITION,
    });
    assert.equal(counts.get(ORGANIZER), 1);
  });

  it("counts each edition of a Partner Alumni series", () => {
    const counts = countEventLinksByCompany({
      editionLinks: [],
      partnerAlumniSeriesLinks: [{ company_id: ALUMNI, event_series_id: SERIES }],
      editions: [
        { id: EDITION_A, series_id: SERIES },
        { id: EDITION_B, series_id: SERIES },
      ],
    });
    assert.equal(counts.get(ALUMNI), 2);
  });

  it("counts one edition when a Partner Alumni series has one edition", () => {
    const counts = countEventLinksByCompany({
      editionLinks: [],
      partnerAlumniSeriesLinks: [{ company_id: ALUMNI, event_series_id: SERIES }],
      editions: ONE_SERIES_EDITION,
    });
    assert.equal(counts.get(ALUMNI), 1);
  });

  it("counts a Partner Alumni series with no editions as zero", () => {
    const counts = countEventLinksByCompany({
      editionLinks: [],
      partnerAlumniSeriesLinks: [{ company_id: ALUMNI, event_series_id: SERIES }],
      editions: [],
    });
    assert.equal(counts.get(ALUMNI) ?? 0, 0);
  });

  it("counts several roles in one edition once", () => {
    const counts = countEventLinksByCompany({
      editionLinks: [
        { company_id: MULTI_ROLE, event_edition_id: EDITION_A },
        { company_id: MULTI_ROLE, event_edition_id: EDITION_A },
        { company_id: MULTI_ROLE, event_edition_id: EDITION_A },
      ],
      partnerAlumniSeriesLinks: [{ company_id: MULTI_ROLE, event_series_id: SERIES }],
      editions: ONE_SERIES_EDITION,
    });
    assert.equal(counts.get(MULTI_ROLE), 1);
  });

  it("counts relationships across multiple editions", () => {
    const counts = countEventLinksByCompany({
      editionLinks: [
        { company_id: MULTI_EDITION, event_edition_id: EDITION_A },
        { company_id: MULTI_EDITION, event_edition_id: EDITION_B },
      ],
      partnerAlumniSeriesLinks: [],
      editions: [
        { id: EDITION_A, series_id: SERIES },
        { id: EDITION_B, series_id: "series-other" },
      ],
    });
    assert.equal(counts.get(MULTI_EDITION), 2);
  });

  it("leaves a company with no relationships at zero", () => {
    const counts = countEventLinksByCompany({
      editionLinks: [{ company_id: SPONSOR, event_edition_id: EDITION_A }],
      partnerAlumniSeriesLinks: [],
      editions: ONE_SERIES_EDITION,
    });
    assert.equal(counts.get(UNLINKED) ?? 0, 0);
  });

  it("includes an edition link past the first 1,000 relationship rows", () => {
    const editionLinks = [
      ...Array.from({ length: SUPABASE_DEFAULT_PAGE_SIZE }, (_, index) => ({
        company_id: `filler-${index}`,
        event_edition_id: `filler-edition-${index}`,
      })),
      { company_id: EXHIBITOR, event_edition_id: EDITION_A },
    ];
    const truncated = countEventLinksByCompany({
      editionLinks: editionLinks.slice(0, SUPABASE_DEFAULT_PAGE_SIZE),
      partnerAlumniSeriesLinks: [],
      editions: ONE_SERIES_EDITION,
    });
    const full = countEventLinksByCompany({
      editionLinks,
      partnerAlumniSeriesLinks: [],
      editions: ONE_SERIES_EDITION,
    });
    assert.equal(truncated.get(EXHIBITOR) ?? 0, 0);
    assert.equal(full.get(EXHIBITOR), 1);
  });
});

describe("currentPartnerAlumniSeriesLinks", () => {
  it("uses the current roster and ignores an older version", () => {
    const links = currentPartnerAlumniSeriesLinks(
      [{ event_series_id: SERIES, current_version_id: "version-current" }],
      [
        { company_id: ALUMNI, event_partner_alumni_version_id: "version-current" },
        { company_id: "former-member", event_partner_alumni_version_id: "version-old" },
      ],
    );
    assert.deepEqual(links, [{ company_id: ALUMNI, event_series_id: SERIES }]);
  });
});

describe("company relationship loading", () => {
  it("pages every relationship table instead of stopping at 1,000 rows", () => {
    const source = readFileSync(
      new URL("./companyAdmin.ts", import.meta.url),
      "utf8",
    );
    for (const table of [
      "event_sponsors",
      "event_exhibitors",
      "event_edition_organizers",
      "event_partner_alumni",
      "event_partner_alumni_version_companies",
      "event_editions",
    ]) {
      assert.match(source, new RegExp(`from\\("${table}"\\)`));
    }
    assert.equal(source.match(/fetchAllPaginatedSupabaseRows</g)?.length, 6);
  });
});
