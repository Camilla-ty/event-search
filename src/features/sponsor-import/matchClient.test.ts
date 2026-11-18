import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MATCH_FAILED_MESSAGE, MATCH_TIMEOUT_MS } from "./matchClient";

describe("matchClient policy", () => {
  it("uses a client timeout below route maxDuration (300s) and above the observed ~164s match", () => {
    assert.ok(MATCH_TIMEOUT_MS > 164_000);
    assert.ok(MATCH_TIMEOUT_MS < 300_000);
    assert.equal(MATCH_TIMEOUT_MS, 280_000);
  });

  it("exposes a recovery-oriented failure message", () => {
    assert.match(MATCH_FAILED_MESSAGE, /Loading any results already saved/i);
  });
});
