import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  fetchAllPaginatedSupabaseRows,
  SUPABASE_DEFAULT_PAGE_SIZE,
} from "@/src/lib/supabase/fetchAllPaginatedRows";

import { countSponsorLinksByCompany } from "./companyAdmin";

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
