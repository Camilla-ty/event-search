/**
 * Backfill: populate `companies.logo_url` by fetching company logos,
 * uploading them to Supabase Storage, and storing the public Storage URL.
 *
 * Safe by default: skips rows where `logo_url` is already set.
 *
 * Run:
 *   npm run backfill:companies-logos
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

type CompanyLogoRow = BackfillRow & {
  name: string | null;
  website: string | null;
  domain: string | null;
  logo_url: string | null;
};

function parseCompanyLogoRow(row: BackfillRow): CompanyLogoRow | null {
  const name = row.name;
  const website = row.website;
  const domain = row.domain;
  const logoUrl = row.logo_url;

  return {
    id: row.id,
    name: typeof name === "string" ? name : null,
    website: typeof website === "string" ? website : null,
    domain: typeof domain === "string" ? domain : null,
    logo_url: typeof logoUrl === "string" ? logoUrl : null,
  };
}

function hasLogoSource(row: CompanyLogoRow): boolean {
  return Boolean(row.website?.trim() || row.domain?.trim());
}

function hasValidLogoDomain(row: CompanyLogoRow): boolean {
  return Boolean(
    normalizeWebsiteToDomain(row.website) ?? normalizeWebsiteToDomain(row.domain),
  );
}

async function main() {
  const supabase = createBackfillSupabaseClient();

  await runBackfillJob<CompanyLogoRow>(supabase, {
    jobName: "companies logo backfill",
    tableName: "companies",
    selectColumns: ["id", "name", "website", "domain", "logo_url"],
    valueColumn: "logo_url",
    parseRow: parseCompanyLogoRow,
    label: (row) => row.name?.trim() || row.domain?.trim() || row.id,
    shouldSkip: (row) => {
      if (!hasLogoSource(row)) {
        return { reason: "no_logo_source", message: "no website or domain" };
      }
      if (!hasValidLogoDomain(row)) {
        return {
          reason: "invalid_domain",
          message: `invalid website/domain: ${row.website ?? row.domain ?? ""}`,
        };
      }
      return null;
    },
    resolveValue: createLogoUploadResolver<CompanyLogoRow>({
      supabase,
      websiteColumn: "website",
      domainColumn: "domain",
      logoColumn: "logo_url",
      storageNamespace: "companies",
    }),
    orderBy: { column: "name", ascending: true },
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error("[backfill] fatal:", message);
  process.exit(1);
});
