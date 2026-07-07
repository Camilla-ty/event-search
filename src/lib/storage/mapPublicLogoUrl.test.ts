import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  mapCompanyLogoEmbedForDisplay,
  mapEventEditionSeriesEmbedForDisplay,
  mapPublicLogoUrl,
} from "./mapPublicLogoUrl";

const SUPABASE_BASE = "https://example.supabase.co";
const SERIES_ID = "00000000-0000-4000-8000-000000000001";

describe("mapPublicLogoUrl", () => {
  const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  afterEach(() => {
    if (originalSupabaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    }
  });

  it("resolves bucket-relative paths for UI display", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_BASE;

    assert.equal(
      mapPublicLogoUrl(`event-series/${SERIES_ID}/logo.jpg`),
      `${SUPABASE_BASE}/storage/v1/object/public/company-logos/event-series/${SERIES_ID}/logo.jpg`,
    );
  });
});

describe("mapCompanyLogoEmbedForDisplay", () => {
  const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  afterEach(() => {
    if (originalSupabaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    }
  });

  it("maps logo_url on company embed rows", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_BASE;

    const mapped = mapCompanyLogoEmbedForDisplay({
      id: "c1",
      logo_url: `companies/${SERIES_ID}/logo.png`,
    });

    assert.equal(
      mapped.logo_url,
      `${SUPABASE_BASE}/storage/v1/object/public/company-logos/companies/${SERIES_ID}/logo.png`,
    );
  });
});

describe("mapEventEditionSeriesEmbedForDisplay", () => {
  const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  afterEach(() => {
    if (originalSupabaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    }
  });

  it("maps nested event_series.logo_url on edition rows", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_BASE;

    const mapped = mapEventEditionSeriesEmbedForDisplay({
      id: "edition-1",
      event_series: {
        name: "NFT NYC",
        logo_url: `event-series/${SERIES_ID}/logo.jpg`,
      },
    });

    assert.equal(
      (mapped.event_series as { logo_url: string }).logo_url,
      `${SUPABASE_BASE}/storage/v1/object/public/company-logos/event-series/${SERIES_ID}/logo.jpg`,
    );
  });
});
