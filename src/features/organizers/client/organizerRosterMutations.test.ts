import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyOrganizerCreate,
  applyOrganizerEdit,
  applyOrganizerRemove,
  applyOrganizerReorder,
} from "@/src/features/organizers/client/organizerRosterMutations";
import type { EditionOrganizerAdminRow } from "@/src/features/organizers/server/eventOrganizerAdmin";

function organizer(
  overrides: Partial<EditionOrganizerAdminRow> & Pick<EditionOrganizerAdminRow, "id">,
): EditionOrganizerAdminRow {
  return {
    event_editions_id: "edition-1",
    company_id: "company-1",
    role_label: "Organizer",
    display_order: 1,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    companies: {
      id: "company-1",
      name: "Acme Corp",
      slug: "acme",
      domain: "acme.com",
      logo_url: null,
    },
    ...overrides,
  };
}

describe("applyOrganizerCreate", () => {
  it("appends a new organizer with company details", () => {
    const next = applyOrganizerCreate([], {
      id: "org-1",
      event_editions_id: "edition-1",
      company_id: "company-2",
      role_label: "Host",
      display_order: 1,
      created_at: null,
      updated_at: null,
    }, {
      id: "company-2",
      name: "Beta LLC",
      domain: "beta.com",
    });

    assert.equal(next.length, 1);
    assert.equal(next[0]?.role_label, "Host");
    assert.equal(next[0]?.companies?.name, "Beta LLC");
  });
});

describe("applyOrganizerEdit", () => {
  it("updates the role label for the edited organizer", () => {
    const current = [organizer({ id: "org-1", role_label: "Organizer" })];
    const next = applyOrganizerEdit(current, {
      id: "org-1",
      event_editions_id: "edition-1",
      company_id: "company-1",
      role_label: "Co-host",
      display_order: 1,
      created_at: null,
      updated_at: "2026-07-02T00:00:00.000Z",
    });

    assert.equal(next[0]?.role_label, "Co-host");
    assert.equal(next[0]?.companies?.name, "Acme Corp");
  });
});

describe("applyOrganizerRemove", () => {
  it("removes the organizer and renumbers display order", () => {
    const current = [
      organizer({ id: "org-1", display_order: 1 }),
      organizer({
        id: "org-2",
        company_id: "company-2",
        display_order: 2,
        companies: {
          id: "company-2",
          name: "Beta LLC",
          slug: null,
          domain: null,
          logo_url: null,
        },
      }),
    ];

    const next = applyOrganizerRemove(current, "org-1");

    assert.equal(next.length, 1);
    assert.equal(next[0]?.id, "org-2");
    assert.equal(next[0]?.display_order, 1);
  });

  it("returns an empty roster when the last organizer is removed", () => {
    const next = applyOrganizerRemove([organizer({ id: "org-1" })], "org-1");
    assert.deepEqual(next, []);
  });
});

describe("applyOrganizerReorder", () => {
  it("preserves company embeds while applying new order", () => {
    const current = [
      organizer({ id: "org-1", display_order: 1 }),
      organizer({
        id: "org-2",
        company_id: "company-2",
        display_order: 2,
        companies: {
          id: "company-2",
          name: "Beta LLC",
          slug: null,
          domain: null,
          logo_url: null,
        },
      }),
    ];

    const next = applyOrganizerReorder(current, [
      {
        id: "org-2",
        event_editions_id: "edition-1",
        company_id: "company-2",
        role_label: "Organizer",
        display_order: 1,
        created_at: null,
        updated_at: null,
      },
      {
        id: "org-1",
        event_editions_id: "edition-1",
        company_id: "company-1",
        role_label: "Organizer",
        display_order: 2,
        created_at: null,
        updated_at: null,
      },
    ]);

    assert.deepEqual(
      next.map((row) => [row.id, row.display_order, row.companies?.name]),
      [
        ["org-2", 1, "Beta LLC"],
        ["org-1", 2, "Acme Corp"],
      ],
    );
  });
});
