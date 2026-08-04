import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  getOrganizerCountsByEditionIds,
  readOrganizerCountForEdition,
} from "@/src/features/organizers/server/eventOrganizerAdmin";

const organizersServerDir = dirname(fileURLToPath(import.meta.url));

function readServerSource(filename: string): string {
  return readFileSync(join(organizersServerDir, filename), "utf8");
}

function extractFunctionBody(source: string, functionName: string): string {
  const marker = `export async function ${functionName}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `missing function ${functionName}`);

  const nextExport = source.indexOf("\nexport ", start + marker.length);
  return nextExport === -1 ? source.slice(start) : source.slice(start, nextExport);
}

describe("getOrganizerCountsByEditionIds", () => {
  it("batches event_edition_organizers rows by edition id and does not N+1", () => {
    const source = readServerSource("eventOrganizerAdmin.ts");
    const body = extractFunctionBody(source, "getOrganizerCountsByEditionIds");

    assert.match(body, /fetchAllByIdInBatches/);
    assert.match(body, /\.from\("event_edition_organizers"\)/);
    assert.match(body, /\.select\("event_editions_id"\)/);
    assert.match(body, /\.in\("event_editions_id", batchIds\)/);
    assert.doesNotMatch(body, /for\s*\(.*edition/);
  });

  it("exports getOrganizerCountsByEditionIds for list wiring", () => {
    assert.equal(typeof getOrganizerCountsByEditionIds, "function");
  });
});

describe("readOrganizerCountForEdition", () => {
  it("returns the mapped count or 0 when missing", () => {
    const counts = new Map([
      ["11111111-1111-1111-1111-111111111111", 3],
      ["22222222-2222-2222-2222-222222222222", 1],
    ]);

    assert.equal(
      readOrganizerCountForEdition(counts, "11111111-1111-1111-1111-111111111111"),
      3,
    );
    assert.equal(
      readOrganizerCountForEdition(counts, "22222222-2222-2222-2222-222222222222"),
      1,
    );
    assert.equal(
      readOrganizerCountForEdition(counts, "33333333-3333-3333-3333-333333333333"),
      0,
    );
  });
});
