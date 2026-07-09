import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const eventsServerDir = dirname(fileURLToPath(import.meta.url));
const featuresDir = join(eventsServerDir, "../..");

function readSource(relativeFromFeatures: string): string {
  return readFileSync(join(featuresDir, relativeFromFeatures), "utf8");
}

function extractFunctionBody(source: string, functionName: string): string {
  const marker = `export async function ${functionName}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `missing function ${functionName}`);

  const nextExport = source.indexOf("\nexport ", start + marker.length);
  return nextExport === -1 ? source.slice(start) : source.slice(start, nextExport);
}

const AUTO_TOUCH_PATTERNS = [
  /touchEditionLastReviewed/,
  /applyEditionUpdateLastReviewedPolicy/,
  /shouldAutoTouchAfterPublish/,
  /shouldAutoTouchSponsorUpdate/,
];

function assertNoAutoTouch(source: string, label: string): void {
  for (const pattern of AUTO_TOUCH_PATTERNS) {
    assert.doesNotMatch(source, pattern, `${label} must not auto-touch last_reviewed_at`);
  }
}

describe("edition last reviewed manual-only wiring", () => {
  it("createEventEdition keeps NULL review timestamp on insert", () => {
    const source = readSource("events/server/createEventEdition.ts");
    const body = extractFunctionBody(source, "createEventEdition");

    assert.match(body, /last_reviewed_at:\s*null/);
    assert.doesNotMatch(body, /last_reviewed_at:\s*input\.last_reviewed_at/);
    assertNoAutoTouch(body, "createEventEdition");
  });

  it("updateEventEdition does not apply auto-review policy", () => {
    const source = readSource("events/server/createEventEdition.ts");
    const body = extractFunctionBody(source, "updateEventEdition");

    assert.match(body, /\.update\(patch\)/);
    assertNoAutoTouch(body, "updateEventEdition");
  });

  it("sponsor admin does not auto-touch last_reviewed_at", () => {
    const source = readSource("events/server/eventSponsorAdmin.ts");
    assertNoAutoTouch(source, "eventSponsorAdmin");
  });

  it("organizer admin does not auto-touch last_reviewed_at", () => {
    const source = readSource("organizers/server/eventOrganizerAdmin.ts");
    assertNoAutoTouch(source, "eventOrganizerAdmin");
  });

  it("sponsor import publish does not auto-touch last_reviewed_at", () => {
    const source = readSource("sponsor-import/server/sponsorImportAdmin.ts");
    const body = extractFunctionBody(source, "publishBatch");
    assertNoAutoTouch(body, "publishBatch");
  });

  it("company merge does not auto-touch last_reviewed_at", () => {
    const source = readSource("companies/server/companyMergeAdmin.ts");
    assertNoAutoTouch(source, "companyMergeAdmin");
  });
});
