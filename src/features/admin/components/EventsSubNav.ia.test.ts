import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { adminEventsSubNavItems } from "@/src/lib/constants/navigation";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

function readRepoSource(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

describe("admin Events navigation IA", () => {
  it("limits Events sub-nav to Event Series and Event Editions", () => {
    assert.deepEqual(
      adminEventsSubNavItems.map((item) => ({ href: item.href, label: item.label })),
      [
        { href: "/admin/events/series", label: "Event Series" },
        { href: "/admin/events/editions", label: "Event Editions" },
      ],
    );
    assert.doesNotMatch(
      readRepoSource("src/lib/constants/navigation.ts"),
      /label: "Overview"|label: "Create event edition"/,
    );
  });

  it("redirects /admin/events to the Event Series list", () => {
    const source = readRepoSource("src/app/admin/events/page.tsx");
    assert.match(source, /redirect\("\/admin\/events\/series"\)/);
    assert.doesNotMatch(source, /Create event edition/);
    assert.doesNotMatch(source, /View all event series/);
  });

  it("keeps Create event edition only on series detail with seriesId", () => {
    const seriesDetail = readRepoSource("src/app/admin/events/series/[id]/page.tsx");
    assert.match(
      seriesDetail,
      /href=\{`\/admin\/events\/editions\/new\?seriesId=\$\{series\.id\}`\}/,
    );
    assert.match(seriesDetail, /Create event edition/);

    const editionsList = readRepoSource(
      "src/features/events/components/admin/AdminEventEditionsPage.tsx",
    );
    assert.doesNotMatch(editionsList, /Create event edition/);
    assert.doesNotMatch(editionsList, /\/admin\/events\/editions\/new/);

    const dashboard = readRepoSource("src/app/admin/page.tsx");
    assert.doesNotMatch(dashboard, /Create event edition/);
    assert.match(dashboard, /Create event series/);
  });

  it("keeps Create event series on the series list", () => {
    const seriesList = readRepoSource("src/app/admin/events/series/page.tsx");
    assert.match(seriesList, /href="\/admin\/events\/series\/new"/);
    assert.match(seriesList, /Create event series/);
  });
});
