/**
 * Mirror catalog-referenced logo objects from the Supabase `company-logos` bucket.
 *
 * Discovers paths from companies.logo_url, event_series.logo_url, and venues.logo_url
 * (not a recursive bucket walk). For full-bucket audits, use listStoragePrefix.ts.
 *
 * Usage:
 *   BACKUP_OUTPUT_ROOT=/tmp/backups/storage \
 *   NEXT_PUBLIC_SUPABASE_URL='...' SUPABASE_SERVICE_ROLE_KEY='...' \
 *     npx tsx scripts/backup/mirror-company-logos.ts
 *
 * Output:
 *   ${BACKUP_OUTPUT_ROOT}/company-logos/mirror/{bucket paths...}
 *   ${BACKUP_OUTPUT_ROOT}/company-logos/mirror/manifest.json
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { createBackfillSupabaseClient } from "../backfill/core/supabase";
import { COMPANY_LOGO_BUCKET } from "../../src/features/companies/server/companyLogoStorage";
import { collectReferencedLogoPaths } from "./lib/collectReferencedLogoPaths";
import {
  buildStorageMirrorManifest,
  type StorageMirrorObjectSummary,
} from "./lib/storageMirrorManifest";
import {
  downloadStorageObjectWithRetry,
  shouldFailStorageMirror,
  STORAGE_MIRROR_MAX_FAILURE_RATE,
} from "./lib/storageDownloadWithRetry";

const REPO_ROOT = process.cwd();
const OUTPUT_ROOT =
  process.env.BACKUP_OUTPUT_ROOT ?? path.join(REPO_ROOT, "supabase/dumps/backups/storage");
const MIRROR_DIR = path.join(OUTPUT_ROOT, "company-logos", "mirror");
const CONCURRENCY = Number.parseInt(process.env.STORAGE_MIRROR_DOWNLOAD_CONCURRENCY ?? "8", 10);

function gitSha(): string | null {
  try {
    return execSync("git rev-parse HEAD", { cwd: REPO_ROOT, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

function supabaseHost(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

async function downloadObjectToMirror(params: {
  supabase: ReturnType<typeof createBackfillSupabaseClient>;
  bucket: string;
  objectPath: string;
}): Promise<StorageMirrorObjectSummary | null> {
  const destination = path.join(MIRROR_DIR, params.objectPath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });

  const result = await downloadStorageObjectWithRetry({
    supabase: params.supabase,
    bucket: params.bucket,
    objectPath: params.objectPath,
  });

  if (!result.ok) {
    console.error(
      `[mirror-company-logos] missing object ${params.objectPath}: ${result.error}`,
    );
    return null;
  }

  fs.writeFileSync(destination, result.bytes);

  return {
    path: params.objectPath,
    size: result.bytes.byteLength,
    updated_at: null,
  };
}

async function mapWithConcurrency<T, TResult>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<TResult>,
): Promise<TResult[]> {
  if (!Number.isFinite(concurrency) || concurrency < 1) {
    throw new Error(`invalid concurrency: ${concurrency}`);
  }

  const results: TResult[] = new Array(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= items.length) return;
      results[current] = await worker(items[current], current);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()));
  return results;
}

async function main(): Promise<void> {
  const supabase = createBackfillSupabaseClient();
  const mirroredAt = new Date().toISOString();

  console.log(`[mirror-company-logos] collecting catalog logo paths from database`);
  const collected = await collectReferencedLogoPaths(supabase);

  console.log(
    `[mirror-company-logos] referenced_paths=${collected.referenced_path_count} skipped_external=${collected.skipped_external_url_count} skipped_invalid=${collected.skipped_invalid_count}`,
  );

  fs.mkdirSync(MIRROR_DIR, { recursive: true });

  console.log(
    `[mirror-company-logos] downloading ${collected.paths.length} objects to ${MIRROR_DIR} (concurrency=${CONCURRENCY})`,
  );

  let completed = 0;
  const downloadResults = await mapWithConcurrency(collected.paths, CONCURRENCY, async (objectPath) => {
    const downloaded = await downloadObjectToMirror({
      supabase,
      bucket: COMPANY_LOGO_BUCKET,
      objectPath,
    });
    completed += 1;
    if (completed % 100 === 0 || completed === collected.paths.length) {
      console.log(`[mirror-company-logos] progress: ${completed}/${collected.paths.length}`);
    }
    return { objectPath, downloaded };
  });

  const downloadedObjects = downloadResults
    .map((result) => result.downloaded)
    .filter((object): object is StorageMirrorObjectSummary => object !== null);

  const missingPaths = downloadResults
    .filter((result) => result.downloaded === null)
    .map((result) => result.objectPath);

  if (
    shouldFailStorageMirror({
      referencedPathCount: collected.referenced_path_count,
      downloadedCount: downloadedObjects.length,
      missingPathCount: missingPaths.length,
    })
  ) {
    throw new Error(
      `[mirror-company-logos] backup failed: downloaded=${downloadedObjects.length} missing=${missingPaths.length} referenced=${collected.referenced_path_count} (hard fail when downloaded_count=0 or missing > ${STORAGE_MIRROR_MAX_FAILURE_RATE * 100}% of referenced paths)`,
    );
  }

  const manifest = buildStorageMirrorManifest({
    bucket: COMPANY_LOGO_BUCKET,
    mirroredAt,
    referencedPathCount: collected.referenced_path_count,
    downloadedObjects,
    missingPaths,
    skippedExternalUrlCount: collected.skipped_external_url_count,
    skippedInvalidCount: collected.skipped_invalid_count,
    supabaseHost: supabaseHost(),
    gitSha: gitSha(),
  });

  const manifestPath = path.join(MIRROR_DIR, "manifest.json");
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log("[mirror-company-logos] summary:");
  console.log(JSON.stringify(manifest, null, 2));
  console.log(`[mirror-company-logos] complete: ${MIRROR_DIR}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
