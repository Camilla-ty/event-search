/**
 * Backfill: fetch company logos, upload to Supabase Storage, store public URL + metadata.
 *
 * Safe by default: skips rows where `logo_url` is already set (unless BACKFILL_FORCE_OVERWRITE=1).
 * Skips rows with `logo_source = manual`.
 *
 * Run:
 *   npm run backfill:companies-logos
 *
 * Resolution order (best to worst):
 *   1. Logo.dev (LOGO_DEV_PUBLISHABLE_KEY)
 *   2. Brandfetch CDN (BRANDFETCH_CLIENT_ID)
 *   3. og:image / twitter:image from the homepage
 *   4. /favicon.ico
 *   5. Google s2 favicons (size 128)
 *
 * Optional env knobs:
 *   BACKFILL_DRY_RUN=1
 *   BACKFILL_LIMIT=10
 *   BACKFILL_DELAY_MS=500
 *   BACKFILL_FORCE_OVERWRITE=1
 *   BACKFILL_LOGO_BUCKET=company-logos
 *   BACKFILL_LOGO_HQ_ONLY=1
 *   LOGO_DEV_PUBLISHABLE_KEY=pk_...
 *   BRANDFETCH_CLIENT_ID=...
 */

import { companyLogoMetadataPatch } from "@/src/features/companies/server/companyLogoMetadata";
import { ingestCompanyLogoByDomain } from "@/src/features/companies/server/companyLogoIngest";
import { scheduleCompanyLogoCleanupAfterPersist } from "@/src/features/companies/server/companyLogoStorage";

import { createBackfillSupabaseClient } from "./backfill/core/supabase";
import { readBackfillEnv } from "./backfill/core/env";
import {
  type BackfillRow,
  type BackfillResolvedValue,
  runBackfillJob,
} from "./backfill/core/runBackfillJob";
import { normalizeWebsiteToDomain } from "./backfill/resolvers/domain";

type CompanyLogoRow = BackfillRow & {
  name: string | null;
  website: string | null;
  domain: string | null;
  logo_url: string | null;
  logo_source: string | null;
  logo_status: string | null;
};

function parseCompanyLogoRow(row: BackfillRow): CompanyLogoRow | null {
  const name = row.name;
  const website = row.website;
  const domain = row.domain;
  const logoUrl = row.logo_url;
  const logoSource = row.logo_source;
  const logoStatus = row.logo_status;

  return {
    id: row.id,
    name: typeof name === "string" ? name : null,
    website: typeof website === "string" ? website : null,
    domain: typeof domain === "string" ? domain : null,
    logo_url: typeof logoUrl === "string" ? logoUrl : null,
    logo_source: typeof logoSource === "string" ? logoSource : null,
    logo_status: typeof logoStatus === "string" ? logoStatus : null,
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

async function resolveCompanyLogo(row: CompanyLogoRow): Promise<BackfillResolvedValue | null> {
  const domain =
    normalizeWebsiteToDomain(row.website) ?? normalizeWebsiteToDomain(row.domain);
  if (!domain) return null;

  const env = readBackfillEnv();
  const result = await ingestCompanyLogoByDomain(domain, {
    companyId: row.id,
    dryRun: env.dryRun,
  });

  if (result.status === "skipped") {
    return null;
  }

  const patch = companyLogoMetadataPatch(result);
  const preview =
    result.preview ??
    result.logoUrl ??
    `${result.status}${result.error ? ` (${result.error})` : ""} for ${domain}`;

  return { patch, preview };
}

async function main() {
  const supabase = createBackfillSupabaseClient();

  await runBackfillJob<CompanyLogoRow>(supabase, {
    jobName: "companies logo backfill",
    tableName: "companies",
    selectColumns: [
      "id",
      "name",
      "website",
      "domain",
      "logo_url",
      "logo_source",
      "logo_status",
    ],
    valueColumn: "logo_url",
    parseRow: parseCompanyLogoRow,
    label: (row) => row.name?.trim() || row.domain?.trim() || row.id,
    shouldSkip: (row) => {
      if (row.logo_source?.trim().toLowerCase() === "manual") {
        return { reason: "manual_logo", message: "logo_source is manual" };
      }
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
    resolveValue: resolveCompanyLogo,
    onRowUpdated: (row, resolved) => {
      const logoUrl =
        typeof resolved.value === "string"
          ? resolved.value
          : typeof resolved.patch?.logo_url === "string"
            ? resolved.patch.logo_url
            : null;
      if (logoUrl) {
        scheduleCompanyLogoCleanupAfterPersist({
          companyId: row.id,
          publicUrl: logoUrl,
        });
      }
    },
    orderBy: { column: "name", ascending: true },
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error("[backfill] fatal:", message);
  process.exit(1);
});
