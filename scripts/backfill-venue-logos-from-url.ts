/**
 * Backfill: ingest external venue logo URLs into Supabase Storage.
 *
 * Targets venue rows where logo_url is set but does not already point at
 * venues/{venueId}/logo.{ext} in the company-logos bucket.
 *
 * Run:
 *   npm run backfill:venue-logos-from-url
 *
 * Optional env:
 *   BACKFILL_DRY_RUN=1
 *   BACKFILL_LIMIT=10
 *   BACKFILL_DELAY_MS=500
 */

import { createBackfillSupabaseClient } from "./backfill/core/supabase";
import { readBackfillEnv } from "./backfill/core/env";
import {
  classifyVenueLogoUrlForBackfill,
  resolveVenueManualLogoUrl,
} from "@/src/features/venues/server/resolveVenueManualLogoUrl";
import { scheduleVenueLogoCleanupAfterPersist } from "@/src/features/venues/server/venueLogoStorage";

type VenueLogoRow = {
  id: string;
  name: string;
  logo_url: string | null;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseVenueLogoRow(row: Record<string, unknown>): VenueLogoRow | null {
  const id = typeof row.id === "string" ? row.id : "";
  if (!id) return null;

  return {
    id,
    name: typeof row.name === "string" ? row.name : id,
    logo_url: typeof row.logo_url === "string" ? row.logo_url : null,
  };
}

async function loadVenueRows(
  supabase: ReturnType<typeof createBackfillSupabaseClient>,
): Promise<VenueLogoRow[]> {
  const batchSize = 50;
  const rows: VenueLogoRow[] = [];
  let from = 0;

  while (true) {
    const to = from + batchSize - 1;
    const { data, error } = await supabase
      .from("venues")
      .select("id, name, logo_url")
      .not("logo_url", "is", null)
      .order("name", { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`[backfill-venue-logos-from-url] venues query failed: ${error.message}`);
    }

    const pageRows = (data ?? [])
      .map((row) => parseVenueLogoRow(row as Record<string, unknown>))
      .filter((row): row is VenueLogoRow => row !== null);

    rows.push(...pageRows);
    if (pageRows.length < batchSize) break;
    from += batchSize;
  }

  return rows;
}

async function main() {
  const env = readBackfillEnv();
  const supabase = createBackfillSupabaseClient();

  console.log("[backfill-venue-logos-from-url] starting");
  console.log("[backfill-venue-logos-from-url] config:", {
    dryRun: env.dryRun,
    limit: env.limit,
    delayMs: env.delayMs,
  });

  const rows = await loadVenueRows(supabase);
  console.log(`[backfill-venue-logos-from-url] loaded ${rows.length} venues with logo_url`);

  let processed = 0;
  let updated = 0;
  let failed = 0;
  const skipped: Record<string, number> = {};

  const incrementSkip = (reason: string) => {
    skipped[reason] = (skipped[reason] ?? 0) + 1;
  };

  for (const row of rows) {
    if (env.limit !== null && processed >= env.limit) {
      console.log(`[backfill-venue-logos-from-url] limit ${env.limit} reached, stopping`);
      break;
    }

    processed += 1;
    const progress = `${processed}/${rows.length}`;
    const label = row.name.trim() || row.id;

    const classification = classifyVenueLogoUrlForBackfill(row.logo_url, row.id);
    if (classification.action === "skip") {
      incrementSkip(classification.reason);
      console.log(
        `[skip] (${progress}) ${label} - ${classification.reason}: ${row.logo_url}`,
      );
      continue;
    }

    const resolved = await resolveVenueManualLogoUrl({
      incomingLogoUrl: row.logo_url,
      existingLogoUrl: row.logo_url,
      venueId: row.id,
    });

    if (!resolved.ok) {
      failed += 1;
      console.error(
        `[fail] (${progress}) ${label} - ingest failed: ${row.logo_url}`,
      );
      continue;
    }

    if (!resolved.applyPatch || !resolved.logo_url) {
      incrementSkip("no_change");
      console.log(`[skip] (${progress}) ${label} - no change after resolve`);
      continue;
    }

    if (env.dryRun) {
      updated += 1;
      console.log(`[dry-run] (${progress}) ${label} -> ${resolved.logo_url}`);
    } else {
      const { error: updateError } = await supabase
        .from("venues")
        .update({
          logo_url: resolved.logo_url,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      if (updateError) {
        failed += 1;
        console.error(
          `[fail] (${progress}) ${label} - update error: ${updateError.message}`,
        );
        continue;
      }

      updated += 1;
      console.log(`[ok]   (${progress}) ${label} -> ${resolved.logo_url}`);

      scheduleVenueLogoCleanupAfterPersist({
        venueId: row.id,
        publicUrl: resolved.logo_url,
      });
    }

    if (env.delayMs > 0) {
      await delay(env.delayMs);
    }
  }

  const skippedTotal = Object.values(skipped).reduce((total, count) => total + count, 0);
  const summary = {
    processed,
    updated,
    skipped,
    skippedTotal,
    failed,
    dryRun: env.dryRun,
  };

  console.log("[backfill-venue-logos-from-url] summary:", summary);
  if (failed > 0) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "unknown";
  console.error("[backfill-venue-logos-from-url] fatal:", message);
  process.exitCode = 1;
});
