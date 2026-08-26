import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { EditionLiveExhibitorsQARoster } from "@/src/features/exhibitors/components/admin/EditionLiveExhibitorsQARoster";
import type { LiveExhibitorRow } from "@/src/features/exhibitors/server/eventExhibitorAdmin";

function exhibitor(
  overrides: Partial<LiveExhibitorRow> & Pick<LiveExhibitorRow, "id" | "company_id">,
): LiveExhibitorRow {
  return {
    tier_rank: 1,
    tier_label: "Gold",
    display_order: 1,
    companies: {
      id: overrides.company_id,
      name: `Company ${overrides.id}`,
      slug: null,
      domain: `${overrides.id}.example.com`,
      logo_url: null,
      logo_source: null,
    },
    ...overrides,
  };
}

function readAdminSource(filename: string): string {
  return readFileSync(
    path.join(process.cwd(), "src/features/exhibitors/components/admin", filename),
    "utf8",
  );
}

describe("EditionLiveExhibitorsQARoster", () => {
  const roster = [
    exhibitor({ id: "a", company_id: "c-a", display_order: 1 }),
    exhibitor({ id: "b", company_id: "c-b", display_order: 2 }),
    exhibitor({
      id: "s",
      company_id: "c-s",
      tier_rank: 2,
      tier_label: "Silver",
      display_order: 1,
    }),
  ];

  it("renders drag handles, move fallbacks, Edit tier, and Remove", () => {
    const html = renderToStaticMarkup(
      <EditionLiveExhibitorsQARoster
        exhibitors={roster}
        onEdit={() => undefined}
        onRemove={() => undefined}
        onMove={() => undefined}
        onReorderTier={() => undefined}
      />,
    );

    assert.match(html, /Drag to reorder within tier/);
    assert.match(html, /No logo/);
    assert.match(html, /Move up within tier/);
    assert.match(html, /Move down within tier/);
    assert.match(html, />Edit tier</);
    assert.match(html, />Remove</);
    assert.match(html, />Gold</);
    assert.match(html, />Silver</);
    assert.match(html, /Add another exhibitor to this tier to reorder/);
  });

  it("renders the shared sponsor logo preview when a company logo URL is present", () => {
    const html = renderToStaticMarkup(
      <EditionLiveExhibitorsQARoster
        exhibitors={[
          exhibitor({
            id: "logo",
            company_id: "c-logo",
            companies: {
              id: "c-logo",
              name: "Acme",
              slug: null,
              domain: "acme.example.com",
              logo_url: "https://cdn.example.com/acme.png",
              logo_source: "manual",
            },
          }),
        ]}
        onReorderTier={() => undefined}
      />,
    );

    assert.match(html, /alt="Acme logo"/);
    assert.match(html, /src="https:\/\/cdn\.example.com\/acme\.png"/);
    assert.match(html, />Manual</);
    assert.doesNotMatch(html, /No logo/);
  });

  it("disables drag handles while saving", () => {
    const html = renderToStaticMarkup(
      <EditionLiveExhibitorsQARoster
        exhibitors={roster}
        reorderDisabled
        onReorderTier={() => undefined}
      />,
    );

    assert.match(html, /Wait for order save to finish before reordering/);
    assert.match(html, /aria-disabled="true"/);
    assert.doesNotMatch(html, /Drag to reorder within tier/);
  });
});

describe("exhibitor DnD roster wiring", () => {
  it("uses dnd-kit sortable contexts and same-tier drag resolution", () => {
    const rosterSource = readAdminSource("EditionLiveExhibitorsQARoster.tsx");
    assert.match(rosterSource, /DndContext/);
    assert.match(rosterSource, /resolveExhibitorDragReorder/);
    assert.match(rosterSource, /onReorderTier/);
    assert.doesNotMatch(rosterSource, /fetch\(/);

    const sectionSource = readAdminSource("EditionLiveExhibitorsTierSection.tsx");
    assert.match(sectionSource, /SortableContext/);
    assert.match(sectionSource, /isOnlyInTier/);

    const rowSource = readAdminSource("LiveExhibitorQARow.tsx");
    assert.match(rowSource, /LiveSponsorLogoPreview/);
    assert.match(rowSource, /useSortable/);
    assert.match(rowSource, /dragDisabled = reorderDisabled \|\| isOnlyInTier/);
    assert.match(rowSource, /Move up within tier/);
    assert.match(rowSource, /Edit tier/);
  });
});
