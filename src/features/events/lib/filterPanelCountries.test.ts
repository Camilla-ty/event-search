import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCountryCheckboxOptions,
  toggleCountrySelection,
} from "@/src/features/events/lib/filterPanelCountries";

const countryOptions = ["Japan", "Singapore", "United Kingdom"];

describe("buildCountryCheckboxOptions", () => {
  it("preserves facet order when nothing is selected", () => {
    assert.deepEqual(buildCountryCheckboxOptions(countryOptions, []), [
      { value: "Japan", label: "Japan" },
      { value: "Singapore", label: "Singapore" },
      { value: "United Kingdom", label: "United Kingdom" },
    ]);
  });

  it("prepends unknown selected countries before facet options", () => {
    assert.deepEqual(
      buildCountryCheckboxOptions(countryOptions, ["Atlantis", "Singapore"]),
      [
        { value: "Atlantis", label: "Atlantis (not found)" },
        { value: "Japan", label: "Japan" },
        { value: "Singapore", label: "Singapore" },
        { value: "United Kingdom", label: "United Kingdom" },
      ],
    );
  });

  it("deduplicates unknown selected countries while preserving first order", () => {
    assert.deepEqual(
      buildCountryCheckboxOptions(countryOptions, ["Atlantis", "Atlantis", "Japan"]),
      [
        { value: "Atlantis", label: "Atlantis (not found)" },
        { value: "Japan", label: "Japan" },
        { value: "Singapore", label: "Singapore" },
        { value: "United Kingdom", label: "United Kingdom" },
      ],
    );
  });
});

describe("toggleCountrySelection", () => {
  it("adds a country when checked", () => {
    assert.deepEqual(toggleCountrySelection([], "Singapore", true), ["Singapore"]);
    assert.deepEqual(toggleCountrySelection(["Singapore"], "Japan", true), [
      "Singapore",
      "Japan",
    ]);
  });

  it("removes a country when unchecked", () => {
    assert.deepEqual(
      toggleCountrySelection(["Singapore", "Japan"], "Singapore", false),
      ["Japan"],
    );
  });

  it("does not duplicate an already selected country", () => {
    assert.deepEqual(toggleCountrySelection(["Singapore"], "Singapore", true), ["Singapore"]);
  });

  it("supports multi-country selection", () => {
    assert.deepEqual(
      toggleCountrySelection(
        toggleCountrySelection([], "Singapore", true),
        "Japan",
        true,
      ),
      ["Singapore", "Japan"],
    );
  });
});
