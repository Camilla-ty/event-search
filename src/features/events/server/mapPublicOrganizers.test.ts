import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mapPublicOrganizersFromEditionRow } from "@/src/features/events/server/mapPublicOrganizers";

describe("mapPublicOrganizersFromEditionRow", () => {
  it("returns empty array when embed is missing", () => {
    assert.deepEqual(mapPublicOrganizersFromEditionRow({}), []);
  });

  it("sorts by display_order ascending with id tie-break", () => {
    const rows = mapPublicOrganizersFromEditionRow({
      event_edition_organizers: [
        {
          id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          role_label: "Co-organizer",
          display_order: 2,
          companies: {
            id: "22222222-2222-2222-2222-222222222222",
            name: "Beta Org",
            slug: "beta-org",
          },
        },
        {
          id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          role_label: "Organizer",
          display_order: 1,
          companies: {
            id: "11111111-1111-1111-1111-111111111111",
            name: "Alpha Org",
            slug: "alpha-org",
            logo_url: "/logos/alpha.png",
          },
        },
      ],
    });

    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.company?.name, "Alpha Org");
    assert.equal(rows[0]?.role_label, "Organizer");
    assert.equal(rows[1]?.company?.name, "Beta Org");
    assert.equal(rows[1]?.role_label, "Co-organizer");
  });

  it("defaults missing role_label to Organizer", () => {
    const rows = mapPublicOrganizersFromEditionRow({
      event_edition_organizers: [
        {
          id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          role_label: "   ",
          display_order: 1,
          companies: { id: "11111111-1111-1111-1111-111111111111", name: "Host" },
        },
      ],
    });

    assert.equal(rows[0]?.role_label, "Organizer");
  });
});
