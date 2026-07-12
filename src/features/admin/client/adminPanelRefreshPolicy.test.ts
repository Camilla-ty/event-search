import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const PANEL_FILES = [
  "src/features/partner-alumni/components/admin/SeriesPartnerAlumniPanel.tsx",
  "src/features/organizers/components/admin/EditionOrganizersPanel.tsx",
  "src/features/sponsor-import/components/EditionImportsPanel.tsx",
] as const;

function readPanelSource(relativePath: (typeof PANEL_FILES)[number]): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("Phase F1 panel refresh policy", () => {
  for (const relativePath of PANEL_FILES) {
    it(`${relativePath} has no success-path router.refresh`, () => {
      const source = readPanelSource(relativePath);
      assert.equal(source.includes("router.refresh"), false);
      assert.equal(source.includes("refreshPage()"), false);
    });
  }
});

describe("SeriesPartnerAlumniPanel local state", () => {
  it("uses applyResponse for mutation success paths", () => {
    const source = readPanelSource(
      "src/features/partner-alumni/components/admin/SeriesPartnerAlumniPanel.tsx",
    );
    assert.match(source, /function applyResponse\(/);
    assert.match(source, /applyResponse\(json\)/);
    assert.match(source, /applyResponse\(payload\)/);
  });
});

describe("EditionOrganizersPanel local state", () => {
  it("updates roster from mutation helpers", () => {
    const source = readPanelSource(
      "src/features/organizers/components/admin/EditionOrganizersPanel.tsx",
    );
    assert.match(source, /applyOrganizerCreate/);
    assert.match(source, /applyOrganizerEdit/);
    assert.match(source, /applyOrganizerRemove/);
    assert.match(source, /applyOrganizerReorder/);
    assert.match(source, /fetchEditionOrganizers/);
  });

  it("passes mutation payloads from OrganizerLinkDrawer", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/features/organizers/components/admin/OrganizerLinkDrawer.tsx",
      ),
      "utf8",
    );
    assert.match(source, /onSaved\(\{ link: data\.link \}\)/);
    assert.match(source, /onSaved\(\{ link: data\.link, company: selectedCompany \}\)/);
  });
});

describe("EditionImportsPanel discard local state", () => {
  it("updates panel state after discard without refreshing the page", () => {
    const source = readPanelSource(
      "src/features/sponsor-import/components/EditionImportsPanel.tsx",
    );
    assert.match(source, /applyEditionImportDiscard/);
    assert.match(source, /onDiscarded=\{handleDiscarded\}/);
    assert.match(source, /useState\(initialData\)/);
  });
});
