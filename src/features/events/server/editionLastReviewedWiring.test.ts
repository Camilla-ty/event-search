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

describe("edition last reviewed server wiring", () => {
  it("createEventEdition uses NULL review timestamp on insert", () => {
    const source = readServerSource("createEventEdition.ts");
    assert.match(source, /editionCreateLastReviewedAtValue\(\)/);
    assert.doesNotMatch(
      extractFunctionBody(source, "createEventEdition"),
      /last_reviewed_at:\s*input\.last_reviewed_at/,
    );
  });

  it("updateEventEdition applies auto-review policy before update", () => {
    const source = readServerSource("createEventEdition.ts");
    const body = extractFunctionBody(source, "updateEventEdition");
    assert.match(body, /applyEditionUpdateLastReviewedPolicy/);
  });

  it("sponsor add and remove call touchEditionLastReviewed", () => {
    const source = readServerSource("eventSponsorAdmin.ts");
    const createBody = extractFunctionBody(source, "createEventSponsorLinkAdmin");
    const deleteBody = extractFunctionBody(source, "deleteEventSponsorLinkAdmin");

    assert.match(createBody, /touchEditionLastReviewed\(editionId\)/);
    assert.match(deleteBody, /touchEditionLastReviewed\(row\.event_editions_id\)/);
  });

  it("sponsor tier update gates touchEditionLastReviewed on shouldAutoTouchSponsorUpdate", () => {
    const source = readServerSource("eventSponsorAdmin.ts");
    const body = extractFunctionBody(source, "updateEventSponsorLinkAdmin");

    assert.match(body, /shouldAutoTouchSponsorUpdate\(current, patch\)/);
    assert.match(body, /touchEditionLastReviewed\(current\.event_editions_id\)/);
  });

  it("sponsor reorder and move do not call touchEditionLastReviewed", () => {
    const source = readServerSource("eventSponsorAdmin.ts");
    const reorderBody = extractFunctionBody(source, "reorderEventSponsorLinksInTierAdmin");
    const moveBody = extractFunctionBody(source, "moveEventSponsorLinkAdmin");

    assert.doesNotMatch(reorderBody, /touchEditionLastReviewed/);
    assert.doesNotMatch(moveBody, /touchEditionLastReviewed/);
  });
});

describe("publishBatch last reviewed wiring", () => {
  it("touches edition only when shouldAutoTouchAfterPublish passes", () => {
    const source = readFileSync(
      join(eventsServerDir, "../../sponsor-import/server/sponsorImportAdmin.ts"),
      "utf8",
    );
    const body = extractFunctionBody(source, "publishBatch");

    assert.match(body, /shouldAutoTouchAfterPublish\(result\)/);
    assert.match(body, /touchEditionLastReviewed\(String\(batch\.event_edition_id\)\)/);
  });
});
