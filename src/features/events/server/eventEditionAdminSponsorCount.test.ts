import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const eventsServerDir = dirname(fileURLToPath(import.meta.url));

function readServerSource(filename: string): string {
  return readFileSync(join(eventsServerDir, filename), "utf8");
}

function extractFunctionBody(source: string, functionName: string): string {
  const marker = `export async function ${functionName}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `missing function ${functionName}`);

  const nextExport = source.indexOf("\nexport ", start + marker.length);
  return nextExport === -1 ? source.slice(start) : source.slice(start, nextExport);
}

describe("listEventEditionsAdmin live sponsor count wiring", () => {
  it("uses paginated getSponsorCountsByEditionIds instead of inline event_sponsors select", () => {
    const source = readServerSource("eventEditionAdmin.ts");
    const body = extractFunctionBody(source, "listEventEditionsAdmin");

    assert.match(body, /getSponsorCountsByEditionIds\(editionIds\)/);
    assert.match(body, /readSponsorCountForEdition\(countByEdition, row\.id\)/);
    assert.match(body, /live_sponsor_count:/);
    assert.doesNotMatch(body, /\.from\("event_sponsors"\)/);
    assert.doesNotMatch(body, /\.in\("event_editions_id"/);
  });
});
