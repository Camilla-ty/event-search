/**
 * Mirror the Supabase `company-logos` bucket to a local directory tree.
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

import { listStorageObjectsUnderPrefix } from "../audit/listStoragePrefix";
import { createBackfillSupabaseClient } from "../backfill/core/supabase";
import { COMPANY_LOGO_BUCKET } from "../../src/features/companies/server/companyLogoStorage";
import { buildStorageMirrorManifest } from "./lib/storageMirrorManifest";

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

function applyUpdatedAtMtime(filePath: string, updatedAt: string | null): void {
  if (!updatedAt) return;
  const updatedMs = Date.parse(updatedAt);
  if (Number.isNaN(updatedMs)) return;
  const updatedSec = updatedMs / 1000;
  fs.utimesSync(filePath, updatedSec, updatedSec);
}

async function downloadObject(params: {
  supabase: ReturnType<typeof createBackfillSupabaseClient>;
  bucket: string;
  objectPath: string;
  updatedAt: string | null;
}): Promise<void> {
  const destination = path.join(MIRROR_DIR, params.objectPath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });

  const { data, error } = await params.supabase.storage
    .from(params.bucket)
    .download(params.objectPath);

  if (error || !data) {
    throw new Error(
      `[mirror-company-logos] download failed for ${params.objectPath}: ${error?.message ?? "no data"}`,
    );
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  fs.writeFileSync(destination, buffer);
  applyUpdatedAtMtime(destination, params.updatedAt);
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (!Number.isFinite(concurrency) || concurrency < 1) {
    throw new Error(`invalid concurrency: ${concurrency}`);
  }

  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= items.length) return;
      await worker(items[current], current);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()));
}

async function main(): Promise<void> {
  const supabase = createBackfillSupabaseClient();
  const mirroredAt = new Date().toISOString();

  console.log(`[mirror-company-logos] listing bucket: ${COMPANY_LOGO_BUCKET}`);
  const objects = await listStorageObjectsUnderPrefix({
    supabase,
    bucket: COMPANY_LOGO_BUCKET,
    prefix: "",
  });

  fs.mkdirSync(MIRROR_DIR, { recursive: true });

  console.log(
    `[mirror-company-logos] downloading ${objects.length} objects to ${MIRROR_DIR} (concurrency=${CONCURRENCY})`,
  );

  let downloaded = 0;
  await mapWithConcurrency(objects, CONCURRENCY, async (object) => {
    await downloadObject({
      supabase,
      bucket: COMPANY_LOGO_BUCKET,
      objectPath: object.path,
      updatedAt: object.updated_at,
    });
    downloaded += 1;
    if (downloaded % 100 === 0 || downloaded === objects.length) {
      console.log(`[mirror-company-logos] progress: ${downloaded}/${objects.length}`);
    }
  });

  const manifest = buildStorageMirrorManifest({
    bucket: COMPANY_LOGO_BUCKET,
    mirroredAt,
    objects,
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
