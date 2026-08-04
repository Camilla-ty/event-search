import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  getExhibitorCountsByEditionIds,
  readExhibitorCountForEdition,
} from "@/src/features/exhibitors/server/eventExhibitorAdmin";

const exhibitorsServerDir = dirname(fileURLToPath(import.meta.url));

function readServerSource(filename: string): string {
  return readFileSync(join(exhibitorsServerDir, filename), "utf8");
}

function extractFunctionBody(source: string, functionName: string): string {
  const marker = `export async function ${functionName}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `missing function ${functionName}`);

  const nextExport = source.indexOf("\nexport ", start + marker.length);
  return nextExport === -1 ? source.slice(start) : source.slice(start, nextExport);
}

describe("getExhibitorCountsByEditionIds", () => {
  it("batches event_exhibitors rows by edition id and does not N+1", () => {
    const source = readServerSource("eventExhibitorAdmin.ts");
    const body = extractFunctionBody(source, "getExhibitorCountsByEditionIds");

    assert.match(body, /fetchAllByIdInBatches/);
    assert.match(body, /\.from\("event_exhibitors"\)/);
    assert.match(body, /\.select\("event_editions_id"\)/);
    assert.match(body, /\.in\("event_editions_id", batchIds\)/);
    assert.doesNotMatch(body, /for\s*\(.*edition/);
  });

  it("exports getExhibitorCountsByEditionIds for list wiring", () => {
    assert.equal(typeof getExhibitorCountsByEditionIds, "function");
  });
});

describe("readExhibitorCountForEdition", () => {
  it("returns the mapped count or 0 when missing", () => {
    const counts = new Map([
      ["11111111-1111-1111-1111-111111111111", 4],
      ["22222222-2222-2222-2222-222222222222", 1],
    ]);

    assert.equal(
      readExhibitorCountForEdition(counts, "11111111-1111-1111-1111-111111111111"),
      4,
    );
    assert.equal(
      readExhibitorCountForEdition(counts, "22222222-2222-2222-2222-222222222222"),
      1,
    );
    assert.equal(
      readExhibitorCountForEdition(counts, "33333333-3333-3333-3333-333333333333"),
      0,
    );
  });
});
