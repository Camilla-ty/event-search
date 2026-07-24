import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const LEGACY_ADMIN_TERMINOLOGY =
  /\b(event series|event edition|event editions|create edition|edition conflict|select edition|per edition|this edition|from this edition|on this edition|no editions|series options|edition profile|edition unavailable|load editions|linked to editions|while editions)\b/i;

const ADMIN_COPY_FILES = [
  {
    path: "../../../../lib/constants/navigation.ts",
    expected: "Event Brands",
  },
  {
    path: "EventEditionForm.tsx",
    expected: "Event brand",
  },
  {
    path: "EventSeriesForm.tsx",
    expected: "Create event brand",
  },
  {
    path: "AdminEventEditionsPage.tsx",
    expected: "Create event",
  },
  {
    path: "EditionSiblingWarnings.tsx",
    expected: "Related events for this event brand",
  },
  {
    path: "../../../sponsor-import/components/NewImportForm.tsx",
    expected: "Select event",
  },
  {
    path: "../../../companies/components/admin/merge/MergeSponsorshipConflictsTable.tsx",
    expected: "Event conflicts",
  },
  {
    path: "../../../organizers/components/admin/RemoveOrganizerModal.tsx",
    expected: "Remove from event",
  },
  {
    path: "../../../venues/components/admin/AdminVenuesPage.tsx",
    expected: "linked to events",
  },
  {
    path: "../../../events/client/fetchAdminEditionsCollection.ts",
    expected: "Failed to load events.",
  },
  {
    path: "../../../companies/server/companyMergeAdmin.ts",
    expected: "Each sponsorship conflict requires a valid event id.",
  },
] as const;

describe("admin event terminology", () => {
  for (const entry of ADMIN_COPY_FILES) {
    it(`uses Event Brand and Event copy in ${entry.path}`, () => {
      const source = readFileSync(new URL(entry.path, import.meta.url), "utf8");

      assert.match(source, new RegExp(entry.expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.doesNotMatch(source, LEGACY_ADMIN_TERMINOLOGY);
    });
  }
});
