import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { SponsorEventContextBanner } from "./SponsorEventContextBanner";

describe("SponsorEventContextBanner", () => {
  it("uses Event terminology for an unknown event filter", () => {
    const html = renderToStaticMarkup(
      <SponsorEventContextBanner
        eventName={null}
        eventSlug="missing-event"
        eventUnknown
        onClear={() => {}}
      />,
    );

    assert.match(html, /Unknown event:/);
    assert.doesNotMatch(html, /event edition/i);
    assert.match(html, /Clear event filter/);
  });
});
