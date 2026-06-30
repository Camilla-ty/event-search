import { describe, expect, it } from "vitest";

import { formatEventSponsorWebsiteSubtitle } from "./eventSponsorUtils";

describe("formatEventSponsorWebsiteSubtitle", () => {
  it("shows hostname from website_url", () => {
    expect(
      formatEventSponsorWebsiteSubtitle({
        website: "https://coindesk.com",
        domain: null,
      }),
    ).toBe("coindesk.com");

    expect(
      formatEventSponsorWebsiteSubtitle({
        website: "https://chain.link",
        domain: null,
      }),
    ).toBe("chain.link");

    expect(
      formatEventSponsorWebsiteSubtitle({
        website: "https://polygon.technology",
        domain: null,
      }),
    ).toBe("polygon.technology");
  });

  it("strips www and paths from website", () => {
    expect(
      formatEventSponsorWebsiteSubtitle({
        website: "https://www.promminer.com/about",
        domain: "promminer.com",
      }),
    ).toBe("promminer.com");
  });

  it("falls back to domain when website is missing", () => {
    expect(
      formatEventSponsorWebsiteSubtitle({
        website: null,
        domain: "promminer.com",
      }),
    ).toBe("promminer.com");
  });

  it("falls back to domain when website does not parse", () => {
    expect(
      formatEventSponsorWebsiteSubtitle({
        website: "not a url",
        domain: "example.com",
      }),
    ).toBe("example.com");
  });

  it("returns null when website and domain are missing", () => {
    expect(formatEventSponsorWebsiteSubtitle({ website: null, domain: null })).toBeNull();
    expect(formatEventSponsorWebsiteSubtitle(null)).toBeNull();
  });
});
