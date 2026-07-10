import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isRetryableStorageListError,
  STORAGE_LIST_MAX_ATTEMPTS,
  storageListRetryDelayMs,
} from "../../audit/listStoragePrefix";

export const STORAGE_DOWNLOAD_ERROR_PREFIX = "[storage-download]";

export type StorageDownloadWithRetryResult =
  | { ok: true; bytes: Buffer }
  | { ok: false; error: string };

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function downloadStorageObjectWithRetry(params: {
  supabase: SupabaseClient;
  bucket: string;
  objectPath: string;
  sleep?: (ms: number) => Promise<void>;
  logRetry?: (message: string) => void;
  random?: () => number;
}): Promise<StorageDownloadWithRetryResult> {
  const sleep = params.sleep ?? defaultSleep;
  const logRetry = params.logRetry ?? ((message: string) => console.error(message));
  const random = params.random ?? Math.random;

  let lastErrorMessage = "unknown error";

  for (let attempt = 1; attempt <= STORAGE_LIST_MAX_ATTEMPTS; attempt += 1) {
    const { data, error } = await params.supabase.storage
      .from(params.bucket)
      .download(params.objectPath);

    if (!error && data) {
      const buffer = Buffer.from(await data.arrayBuffer());
      return { ok: true, bytes: buffer };
    }

    lastErrorMessage = error?.message ?? "no data";

    const canRetry =
      attempt < STORAGE_LIST_MAX_ATTEMPTS && isRetryableStorageListError(lastErrorMessage);
    if (!canRetry) {
      return { ok: false, error: lastErrorMessage };
    }

    const delayMs = storageListRetryDelayMs(attempt, random);
    logRetry(
      `${STORAGE_DOWNLOAD_ERROR_PREFIX} download retry attempt ${attempt + 1}/${STORAGE_LIST_MAX_ATTEMPTS} for ${params.objectPath} delaying ${delayMs}ms: ${lastErrorMessage}`,
    );
    await sleep(delayMs);
  }

  return { ok: false, error: lastErrorMessage };
}

export const STORAGE_MIRROR_MAX_FAILURE_RATE = 0.05;

export function shouldFailStorageMirror(params: {
  referencedPathCount: number;
  downloadedCount: number;
  missingPathCount: number;
}): boolean {
  if (params.referencedPathCount === 0 || params.downloadedCount === 0) {
    return true;
  }

  return params.missingPathCount / params.referencedPathCount > STORAGE_MIRROR_MAX_FAILURE_RATE;
}
