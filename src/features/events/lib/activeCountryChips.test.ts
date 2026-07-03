import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildActiveCountryChips } from "@/src/features/events/lib/activeCountryChips";
import { toggleCountrySelection } from "@/src/features/events/lib/filterPanelCountries";

const countryOptions = ["Japan", "Singapore", "United Kingdom"];

describe("buildActiveCountryChips", () => {
  it("returns no chips when no countries are active", () => {
    assert.deepEqual(buildActiveCountryChips([], countryOptions), []);
  });

  it("renders one chip per active country in selection order", () => {
    const chips = buildActiveCountryChips(
      ["Singapore", "United Kingdom", "Japan"],
      countryOptions,
    );

    assert.equal(chips.length, 3);
    assert.deepEqual(
      chips.map((chip) => chip.label),
      ["Singapore", "United Kingdom", "Japan"],
    );
  });

  it("deduplicates repeated countries in the selection", () => {
    const chips = buildActiveCountryChips(["Singapore", "Singapore"], countryOptions);
    assert.equal(chips.length, 1);
    assert.equal(chips[0]?.value, "Singapore");
  });

  it("labels unknown countries as not found", () => {
    const chips = buildActiveCountryChips(["Atlantis"], countryOptions);

    assert.deepEqual(chips, [
      {
        value: "Atlantis",
        label: "Atlantis (not found)",
        unknown: true,
      },
    ]);
  });

  it("mixes known and unknown country chips", () => {
    const chips = buildActiveCountryChips(
      ["Singapore", "Atlantis", "Japan"],
      countryOptions,
    );

    assert.deepEqual(
      chips.map((chip) => chip.label),
      ["Singapore", "Atlantis (not found)", "Japan"],
    );
  });
});

describe("active country chip removal", () => {
  it("removes only the targeted country", () => {
    const nextRegions = toggleCountrySelection(
      ["Singapore", "Japan", "United Kingdom"],
      "Japan",
      false,
    );
    const chips = buildActiveCountryChips(nextRegions, countryOptions);

    assert.deepEqual(
      chips.map((chip) => chip.value),
      ["Singapore", "United Kingdom"],
    );
  });

  it("clears all country chips when regions become empty", () => {
    const nextRegions = toggleCountrySelection(["Singapore", "Japan"], "Singapore", false);
    const afterSecond = toggleCountrySelection(nextRegions, "Japan", false);

    assert.deepEqual(afterSecond, []);
    assert.deepEqual(buildActiveCountryChips(afterSecond, countryOptions), []);
  });

  it("clears all chips when clear all empties both topics and countries", () => {
    const clearedRegions = toggleCountrySelection(
      toggleCountrySelection(["Singapore", "United Kingdom"], "Singapore", false),
      "United Kingdom",
      false,
    );

    assert.deepEqual(clearedRegions, []);
    assert.deepEqual(buildActiveCountryChips(clearedRegions, countryOptions), []);
  });
});
