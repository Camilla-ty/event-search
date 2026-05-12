/**
 * Backfill: populate `event_series.logo_url` by fetching website logos,
 * uploading them to Supabase Storage, and storing the public Storage URL.
 *
 * Safe by default: skips rows where `logo_url` is already set.
 *
 * Run:
 *   npm run backfill:event-series-logos
 *
 * Resolution order (best to worst):
 *   1. Brandfetch CDN (only if BRANDFETCH_CLIENT_ID is set)
 *   2. Clearbit logo provider
 *   3. og:image / twitter:image from the homepage
 *   4. /favicon.ico
 *   5. Google s2 favicons (size 128)
 * Set BACKFILL_LOGO_HQ_ONLY=1 to disable steps 4 and 5 for major-brand reruns.
 *
 * Optional env knobs:
 *   BACKFILL_DRY_RUN=1
 *   BACKFILL_LIMIT=5
 *   BACKFILL_DELAY_MS=500
 *   BACKFILL_FORCE_OVERWRITE=1
 *   BACKFILL_LOGO_BUCKET=company-logos
 *   BACKFILL_LOGO_HQ_ONLY=1
 *   BRANDFETCH_CLIENT_ID=...
 */

import { createBackfillSupabaseClient } from "./backfill/core/supabase";
import {
  type BackfillRow,
  runBackfillJob,
} from "./backfill/core/runBackfillJob";
import { normalizeWebsiteToDomain } from "./backfill/resolvers/domain";
import { createLogoUploadResolver } from "./backfill/resolvers/logoUpload";

type EventSeriesLogoRow = BackfillRow & {
  name: string | null;
  website_url: string | null;
  logo_url: string | null;
};

function parseEventSeriesLogoRow(row: BackfillRow): EventSeriesLogoRow | null {
  const name = row.name;
  const websiteUrl = row.website_url;
  const logoUrl = row.logo_url;

  return {
    id: row.id,
    name: typeof name === "string" ? name : null,
    website_url: typeof websiteUrl === "string" ? websiteUrl : null,
    logo_url: typeof logoUrl === "string" ? logoUrl : null,
  };
}

async function main() {
  const supabase = createBackfillSupabaseClient();

  await runBackfillJob<EventSeriesLogoRow>(supabase, {
    jobName: "event_series logo backfill",
    tableName: "event_series",
    selectColumns: ["id", "name", "website_url", "logo_url"],
    valueColumn: "logo_url",
    parseRow: parseEventSeriesLogoRow,
    label: (row) => row.name?.trim() || row.id,
    shouldSkip: (row) => {
      if (!row.website_url || row.website_url.trim() === "") {
        return { reason: "no_website_url", message: "no website_url" };
      }
      if (!normalizeWebsiteToDomain(row.website_url)) {
        return {
          reason: "invalid_domain",
          message: `invalid website_url: ${row.website_url}`,
        };
      }
      return null;
    },
    resolveValue: createLogoUploadResolver<EventSeriesLogoRow>({
      supabase,
      websiteColumn: "website_url",
      logoColumn: "logo_url",
      storageNamespace: "event-series",
    }),
    orderBy: { column: "name", ascending: true },
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error("[backfill] fatal:", message);
  process.exit(1);
});
