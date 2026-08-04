import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/** Ban legacy Admin Event Brand copy and ambiguous standalone "event" patterns. */
const LEGACY_ADMIN_TERMINOLOGY =
  /\b(event brand|event brands|create event brand|create event(?! (?:series|edition))|select event(?! edition)|remove from event(?! edition)|failed to load events|event conflicts|linked to events|related events for this event brand)\b/i;

const ADMIN_COPY_FILES = [
  {
    path: "../../../../lib/constants/navigation.ts",
    expected: "Event Series",
  },
  {
    path: "EventEditionForm.tsx",
    expected: "Event Series",
  },
  {
    path: "EventSeriesForm.tsx",
    expected: "Create event series",
  },
  {
    path: "../../../../app/admin/events/series/[id]/page.tsx",
    expected: "Create event edition",
  },
  {
    path: "EditionSiblingWarnings.tsx",
    expected: "Related event editions for this event series",
  },
  {
    path: "../../../sponsor-import/components/NewImportForm.tsx",
    expected: "Select event edition",
  },
  {
    path: "../../../companies/components/admin/merge/MergeSponsorshipConflictsTable.tsx",
    expected: "Event edition conflicts",
  },
  {
    path: "../../../organizers/components/admin/RemoveOrganizerModal.tsx",
    expected: "Remove from event edition",
  },
  {
    path: "../../../venues/components/admin/AdminVenuesPage.tsx",
    expected: "linked to event editions",
  },
  {
    path: "../../../events/client/fetchAdminEditionsCollection.ts",
    expected: "Failed to load event editions.",
  },
  {
    path: "../../../companies/server/companyMergeAdmin.ts",
    expected: "Each sponsorship conflict requires a valid event edition id.",
  },
] as const;

describe("admin event terminology", () => {
  for (const entry of ADMIN_COPY_FILES) {
    it(`uses Event Series / Event Edition copy in ${entry.path}`, () => {
      const source = readFileSync(new URL(entry.path, import.meta.url), "utf8");

      assert.match(source, new RegExp(entry.expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.doesNotMatch(source, LEGACY_ADMIN_TERMINOLOGY);
    });
  }
});
