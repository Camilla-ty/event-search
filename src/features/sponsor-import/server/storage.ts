import { createAdminClient } from "@/src/lib/supabase/admin";

import { SPONSOR_IMPORT_BUCKET } from "../types";

let bucketEnsured = false;

/** Ensure private sponsor-imports bucket exists (idempotent per process). */
export async function ensureSponsorImportBucket(): Promise<void> {
  if (bucketEnsured) return;

  const supabase = createAdminClient();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    throw new Error(`Failed to list storage buckets: ${listError.message}`);
  }

  const exists = buckets.some((b) => b.name === SPONSOR_IMPORT_BUCKET);
  if (!exists) {
    const { error: createError } = await supabase.storage.createBucket(SPONSOR_IMPORT_BUCKET, {
      public: false,
      fileSizeLimit: 20 * 1024 * 1024,
    });
    if (createError && !createError.message.toLowerCase().includes("already exists")) {
      throw new Error(`Failed to create bucket ${SPONSOR_IMPORT_BUCKET}: ${createError.message}`);
    }
  }

  bucketEnsured = true;
}

export function buildStoragePath(batchId: string, filename: string): string {
  const safeName = filename.replace(/[/\\]/g, "_").trim() || "upload.bin";
  return `${batchId}/${safeName}`;
}

export async function uploadSourceFile(
  batchId: string,
  filename: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<string> {
  await ensureSponsorImportBucket();
  const supabase = createAdminClient();
  const path = buildStoragePath(batchId, filename);

  const { error } = await supabase.storage.from(SPONSOR_IMPORT_BUCKET).upload(path, bytes, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  return path;
}

/** Remove uploaded source file from the private sponsor-imports bucket. */
export async function deleteSourceFile(storagePath: string): Promise<void> {
  const path = storagePath.trim();
  if (!path) return;

  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(SPONSOR_IMPORT_BUCKET).remove([path]);
  if (error) {
    throw new Error(`Storage delete failed: ${error.message}`);
  }
}
