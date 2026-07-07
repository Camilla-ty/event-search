import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatLocationLabel } from "@/src/lib/location/formatLocationLabel";

describe("formatLocationLabel", () => {
  it("formats US events as City, State", () => {
    assert.equal(
      formatLocationLabel({
        city: "Las Vegas",
        state: "Nevada",
        country: "United States",
      }),
      "Las Vegas, Nevada",
    );
    assert.equal(
      formatLocationLabel({
        city: "Miami",
        state: "Florida",
        country: "United States",
      }),
      "Miami, Florida",
    );
    assert.equal(
      formatLocationLabel({
        city: "Denver",
        state: "Colorado",
        country: "United States",
      }),
      "Denver, Colorado",
    );
  });

  it("formats non-US events as City, Country when names differ", () => {
    assert.equal(
      formatLocationLabel({
        city: "Prague",
        state: null,
        country: "Czech Republic",
      }),
      "Prague, Czech Republic",
    );
    assert.equal(
      formatLocationLabel({
        city: "Stockholm",
        state: null,
        country: "Sweden",
      }),
      "Stockholm, Sweden",
    );
  });

  it("prefers country over state for non-US events", () => {
    assert.equal(
      formatLocationLabel({
        city: "Toronto",
        state: "Ontario",
        country: "Canada",
      }),
      "Toronto, Canada",
    );
  });

  it("shows a single value when city and country are the same", () => {
    assert.equal(
      formatLocationLabel({
        city: "Singapore",
        state: null,
        country: "Singapore",
      }),
      "Singapore",
    );
  });

  it("returns city only when no distinct state or country is available", () => {
    assert.equal(formatLocationLabel({ city: "Singapore" }), "Singapore");
    assert.equal(formatLocationLabel({ city: "  Dubai  " }), "Dubai");
  });

  it("returns empty string when city is missing", () => {
    assert.equal(
      formatLocationLabel({ city: "", state: "Nevada", country: "United States" }),
      "",
    );
  });

  it("ignores state when it duplicates the city name", () => {
    assert.equal(
      formatLocationLabel({
        city: "Georgia",
        state: "Georgia",
        country: "United States",
      }),
      "Georgia",
    );
  });
});
