import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "EventEditionForm.tsx"),
  "utf8",
);

describe("EventEditionForm create last_reviewed_at", () => {
  it("Create and Create & Import submit the same last_reviewed_at payload", () => {
    assert.match(source, /function buildPayload\(\)/);
    assert.match(source, /last_reviewed_at:\s*values\.last_reviewed_at\.trim\(\) \|\| null/);
    assert.match(source, /const payload = buildPayload\(\)/);
    assert.match(source, /onClick=\{\(\) => void handleSave\("import"\)\}/);
    assert.match(source, /onClick=\{\(\) => void handleSave\("detail"\)\}/);
    assert.match(
      source,
      /mode === "create"\s*\?[\s\S]*handleSave\("import"\)[\s\S]*handleSave\("detail"\)/,
    );
  });
});
