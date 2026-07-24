import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { DUPLICATE_EXHIBITOR_LINK_MESSAGE } from "@/src/features/exhibitors/server/eventExhibitorAdmin";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function readRepo(relativeFromSrc: string): string {
  return readFileSync(join(root, relativeFromSrc), "utf8");
}

describe("event exhibitor admin API wiring", () => {
  it("create route maps duplicate links to 409", () => {
    const source = readRepo("app/api/admin/event-editions/[id]/exhibitors/route.ts");
    assert.match(source, /DUPLICATE_EXHIBITOR_LINK_MESSAGE/);
    assert.match(source, /\?\s*409/);
    assert.match(source, /COMPANY_NOT_LINKABLE_MESSAGE/);
  });

  it("reorder route maps membership validation failures to 400", () => {
    const source = readRepo(
      "app/api/admin/event-editions/[id]/exhibitors/reorder/route.ts",
    );
    assert.match(source, /isClientReorderError/);
    assert.match(source, /status: isClientReorderError \? 400 : 500/);
  });

  it("create admin path enforces assertCompanyLinkable", () => {
    const source = readRepo("features/exhibitors/server/eventExhibitorAdmin.ts");
    assert.match(source, /assertCompanyLinkable\(company\)/);
    assert.match(source, new RegExp(DUPLICATE_EXHIBITOR_LINK_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(source, /touchEditionLastReviewed/);
  });

  it("exports the duplicate message used by the API", () => {
    assert.equal(
      DUPLICATE_EXHIBITOR_LINK_MESSAGE,
      "This company is already an exhibitor of this event.",
    );
  });
});
