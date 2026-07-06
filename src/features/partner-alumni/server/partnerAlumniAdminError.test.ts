import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DELETE_CURRENT_VERSION_MESSAGE,
  SET_CURRENT_ZERO_MEMBERS_MESSAGE,
} from "@/src/features/partner-alumni/server/partnerAlumniAdminError";

describe("Partner Alumni v2 admin error messages", () => {
  it("defines delete-current guard message", () => {
    assert.match(DELETE_CURRENT_VERSION_MESSAGE, /current version/i);
  });

  it("defines set-current zero members message", () => {
    assert.match(SET_CURRENT_ZERO_MEMBERS_MESSAGE, /no companies/i);
  });
});
