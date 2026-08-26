import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { mapExhibitorDrawerCompanyOption } from "@/src/features/exhibitors/components/admin/ExhibitorLinkDrawer";

describe("mapExhibitorDrawerCompanyOption", () => {
  it("keeps logo_url and logo_source from admin company search hits", () => {
    assert.deepEqual(
      mapExhibitorDrawerCompanyOption({
        id: "company-1",
        name: "Acme",
        domain: "acme.example.com",
        logo_url: "companies/company-1/logo.png",
        logo_source: "storage",
        matched_alias: "Acme Inc",
      }),
      {
        id: "company-1",
        name: "Acme",
        domain: "acme.example.com",
        logo_url: "companies/company-1/logo.png",
        logo_source: "storage",
        matched_alias: "Acme Inc",
      },
    );
  });

  it("defaults missing logo fields to null so the preview can show No logo", () => {
    assert.deepEqual(
      mapExhibitorDrawerCompanyOption({
        id: "company-2",
        name: "Beta",
      }),
      {
        id: "company-2",
        name: "Beta",
        domain: null,
        logo_url: null,
        logo_source: null,
        matched_alias: null,
      },
    );
  });
});

describe("add-exhibitor create payload keeps search logos", () => {
  const panelSource = readFileSync(
    path.join(
      process.cwd(),
      "src/features/exhibitors/components/admin/EditionExhibitorsPanel.tsx",
    ),
    "utf8",
  );
  const drawerSource = readFileSync(
    path.join(
      process.cwd(),
      "src/features/exhibitors/components/admin/ExhibitorLinkDrawer.tsx",
    ),
    "utf8",
  );

  it("maps search hits through mapExhibitorDrawerCompanyOption", () => {
    assert.match(drawerSource, /data\.companies\.map\(mapExhibitorDrawerCompanyOption\)/);
  });

  it("inserts the selected company logo fields onto the new live row", () => {
    const createdFn = panelSource.match(/function handleCreated\([\s\S]*?\n  \}/)?.[0];
    assert.ok(createdFn, "handleCreated should exist");
    assert.match(createdFn, /logo_url:\s*payload\.company\.logo_url/);
    assert.match(createdFn, /logo_source:\s*payload\.company\.logo_source/);
    assert.doesNotMatch(createdFn, /logo_url:\s*null/);
  });
});
