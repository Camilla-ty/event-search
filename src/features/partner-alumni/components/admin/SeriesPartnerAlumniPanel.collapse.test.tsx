import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";

import {
  SeriesPartnerAlumniPanel,
  SeriesPartnerAlumniPanelHeader,
  buildPartnerAlumniSectionSummary,
} from "@/src/features/partner-alumni/components/admin/SeriesPartnerAlumniPanel";
import type {
  PartnerAlumniAdminData,
  PartnerAlumniVersionSummary,
} from "@/src/features/partner-alumni/server/partnerAlumniAdmin";

const panelPath = path.join(
  process.cwd(),
  "src/features/partner-alumni/components/admin/SeriesPartnerAlumniPanel.tsx",
);

function versionSummary(
  overrides: Partial<PartnerAlumniVersionSummary> & Pick<PartnerAlumniVersionSummary, "id">,
): PartnerAlumniVersionSummary {
  return {
    version_label: null,
    recognition_label: null,
    primary_source_url: null,
    source_checked_at: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    member_count: 0,
    is_current: false,
    ...overrides,
  };
}

function adminData(
  overrides: Partial<PartnerAlumniAdminData> = {},
): PartnerAlumniAdminData {
  return {
    program: null,
    versions: [],
    selected_version: null,
    ...overrides,
  };
}

describe("buildPartnerAlumniSectionSummary", () => {
  it("labels empty programs as No versions yet", () => {
    assert.deepEqual(buildPartnerAlumniSectionSummary(adminData()), {
      statusLabel: "No versions yet",
    });
  });

  it("summarizes the current version and partner count", () => {
    assert.deepEqual(
      buildPartnerAlumniSectionSummary(
        adminData({
          program: {
            id: "program-1",
            event_series_id: "series-1",
            current_version_id: "version-current",
            created_at: "2026-07-01T00:00:00.000Z",
            updated_at: "2026-07-01T00:00:00.000Z",
          },
          versions: [
            versionSummary({
              id: "version-current",
              version_label: "2026 Partners",
              member_count: 12,
              is_current: true,
            }),
          ],
        }),
      ),
      { statusLabel: "Current: 2026 Partners · 12 partners" },
    );
  });

  it("uses singular partner wording for one member", () => {
    assert.deepEqual(
      buildPartnerAlumniSectionSummary(
        adminData({
          versions: [
            versionSummary({
              id: "version-current",
              version_label: "Solo",
              member_count: 1,
              is_current: true,
            }),
          ],
        }),
      ),
      { statusLabel: "Current: Solo · 1 partner" },
    );
  });

  it("notes when versions exist but none is current", () => {
    assert.deepEqual(
      buildPartnerAlumniSectionSummary(
        adminData({
          versions: [
            versionSummary({ id: "v1", version_label: "Draft A", member_count: 3 }),
            versionSummary({ id: "v2", version_label: "Draft B", member_count: 0 }),
          ],
        }),
      ),
      { statusLabel: "2 versions · no current version" },
    );
  });

  it("surfaces load failures in the collapsed summary", () => {
    assert.deepEqual(buildPartnerAlumniSectionSummary(adminData(), "timeout"), {
      statusLabel: "Could not load",
    });
  });
});

describe("SeriesPartnerAlumniPanelHeader collapsed chrome", () => {
  it("shows No versions yet and Show when collapsed", () => {
    const html = renderToStaticMarkup(
      <SeriesPartnerAlumniPanelHeader
        summary={buildPartnerAlumniSectionSummary(adminData())}
        expanded={false}
        onToggle={() => {}}
      />,
    );

    assert.match(html, /Partner Alumni/);
    assert.match(html, /No versions yet/);
    assert.match(html, /aria-expanded="false"/);
    assert.match(html, />Show</);
  });

  it("shows Hide when expanded", () => {
    const html = renderToStaticMarkup(
      <SeriesPartnerAlumniPanelHeader
        summary={{ statusLabel: "Current: 2026 Partners · 12 partners" }}
        expanded
        onToggle={() => {}}
      />,
    );

    assert.match(html, /Current: 2026 Partners · 12 partners/);
    assert.match(html, /aria-expanded="true"/);
    assert.match(html, />Hide</);
  });
});

describe("SeriesPartnerAlumniPanel collapse wiring", () => {
  it("collapses by default and only expands when the admin chooses", () => {
    const source = readFileSync(panelPath, "utf8");
    assert.match(source, /const \[expanded, setExpanded\] = useState\(false\)/);
    assert.match(source, /SeriesPartnerAlumniPanelHeader/);
    assert.match(source, /setExpanded\(\(current\) => !current\)/);
    assert.match(source, /\{expanded \? \(/);
    assert.match(source, /Create New Version/);
    assert.match(source, /buildPartnerAlumniSectionSummary/);
  });
});

describe("SeriesPartnerAlumniPanel Show / Hide interaction", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    container?.remove();
    container = null;
    root = null;
  });

  function mount(data: PartnerAlumniAdminData = adminData()) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root?.render(
        <SeriesPartnerAlumniPanel seriesId="series-1" initialData={data} />,
      );
    });
  }

  it("is collapsed by default and expands Create New Version after Show", () => {
    mount();
    assert.ok(container);

    assert.match(container.textContent ?? "", /No versions yet/);
    assert.match(container.textContent ?? "", /Show/);
    assert.doesNotMatch(container.textContent ?? "", /Create New Version/);
    assert.equal(
      container.querySelector("#partner-alumni-panel"),
      null,
    );

    const toggle = container.querySelector("#partner-alumni-toggle");
    assert.ok(toggle);
    act(() => {
      (toggle as HTMLButtonElement).click();
    });

    assert.match(container.textContent ?? "", /Hide/);
    assert.match(container.textContent ?? "", /Create New Version/);
    assert.match(
      container.textContent ?? "",
      /No versions yet\. Create a version to start building a partner roster/,
    );
    assert.ok(container.querySelector("#partner-alumni-panel"));
  });

  it("collapses again on Hide and keeps management actions hidden", () => {
    mount(
      adminData({
        versions: [
          versionSummary({
            id: "version-current",
            version_label: "2026 Partners",
            member_count: 4,
            is_current: true,
          }),
        ],
      }),
    );
    assert.ok(container);

    assert.match(container.textContent ?? "", /Current: 2026 Partners · 4 partners/);
    assert.doesNotMatch(container.textContent ?? "", /Create New Version/);

    const toggle = container.querySelector("#partner-alumni-toggle") as HTMLButtonElement;
    act(() => {
      toggle.click();
    });
    assert.match(container.textContent ?? "", /Create New Version/);

    act(() => {
      toggle.click();
    });
    assert.match(container.textContent ?? "", /Show/);
    assert.doesNotMatch(container.textContent ?? "", /Create New Version/);
    assert.equal(container.querySelector("#partner-alumni-panel"), null);
  });
});
