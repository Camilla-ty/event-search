import type { SupabaseClient } from "@supabase/supabase-js";

export const STORAGE_LIST_ERROR_PREFIX = "[storage-list]";

export const STORAGE_LIST_MAX_ATTEMPTS = 5;

/** Backoff delays (ms) before attempts 2–5. */
export const STORAGE_LIST_RETRY_BACKOFF_MS = [1000, 2000, 4000, 8000] as const;

const STORAGE_LIST_RETRY_JITTER_MS = 250;

export type ListedStorageObject = {
  path: string;
  updated_at: string | null;
  size: number | null;
};

type StorageListItem = {
  name: string;
  id: string | null;
  updated_at?: string | null;
  metadata?: { size?: number } | null;
};

type StorageListError = { message: string };

type ListStoragePageResult = {
  data: StorageListItem[] | null;
  error: StorageListError | null;
};

export function isRetryableStorageListError(message: string): boolean {
  const normalized = message.toLowerCase();

  if (/\b429\b/.test(message)) return true;
  if (/\b502\b/.test(message)) return true;
  if (/\b503\b/.test(message)) return true;
  if (/\b504\b/.test(message)) return true;
  if (normalized.includes("gateway timeout")) return true;
  if (normalized.includes("timeout")) return true;
  if (normalized.includes("econnreset")) return true;
  if (normalized.includes("fetch failed")) return true;

  return false;
}

export function storageListRetryDelayMs(
  failedAttempt: number,
  random: () => number = Math.random,
): number {
  const backoffIndex = Math.max(0, Math.min(failedAttempt - 1, STORAGE_LIST_RETRY_BACKOFF_MS.length - 1));
  const base = STORAGE_LIST_RETRY_BACKOFF_MS[backoffIndex];
  const jitter = Math.floor(random() * STORAGE_LIST_RETRY_JITTER_MS);
  return base + jitter;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function formatListFailurePath(folder: string, prefix: string): string {
  return folder || prefix;
}

function throwListFailure(folder: string, prefix: string, message: string): never {
  throw new Error(
    `${STORAGE_LIST_ERROR_PREFIX} list failed for ${formatListFailurePath(folder, prefix)}: ${message}`,
  );
}

export async function listStoragePageWithRetry(params: {
  list: () => Promise<ListStoragePageResult>;
  folder: string;
  prefix: string;
  sleep?: (ms: number) => Promise<void>;
  logRetry?: (message: string) => void;
  random?: () => number;
}): Promise<StorageListItem[]> {
  const sleep = params.sleep ?? defaultSleep;
  const logRetry = params.logRetry ?? ((message: string) => console.error(message));
  const random = params.random ?? Math.random;

  let lastErrorMessage = "unknown error";

  for (let attempt = 1; attempt <= STORAGE_LIST_MAX_ATTEMPTS; attempt += 1) {
    const { data, error } = await params.list();

    if (!error) {
      return data ?? [];
    }

    lastErrorMessage = error.message;

    const canRetry =
      attempt < STORAGE_LIST_MAX_ATTEMPTS && isRetryableStorageListError(error.message);
    if (!canRetry) {
      throwListFailure(params.folder, params.prefix, lastErrorMessage);
    }

    const delayMs = storageListRetryDelayMs(attempt, random);
    logRetry(
      `${STORAGE_LIST_ERROR_PREFIX} list retry attempt ${attempt + 1}/${STORAGE_LIST_MAX_ATTEMPTS} for ${formatListFailurePath(params.folder, params.prefix)} delaying ${delayMs}ms: ${error.message}`,
    );
    await sleep(delayMs);
  }

  throwListFailure(params.folder, params.prefix, lastErrorMessage);
}

export async function listStorageObjectsUnderPrefix(params: {
  supabase: SupabaseClient;
  bucket: string;
  prefix: string;
  sleep?: (ms: number) => Promise<void>;
  logRetry?: (message: string) => void;
}): Promise<ListedStorageObject[]> {
  const results: ListedStorageObject[] = [];

  async function walk(folder: string): Promise<void> {
    let offset = 0;
    const limit = 1000;

    while (true) {
      const data = await listStoragePageWithRetry({
        folder,
        prefix: params.prefix,
        sleep: params.sleep,
        logRetry: params.logRetry,
        list: async () => {
          const result = await params.supabase.storage.from(params.bucket).list(folder, {
            limit,
            offset,
            sortBy: { column: "name", order: "asc" },
          });

          return {
            data: (result.data ?? null) as StorageListItem[] | null,
            error: result.error ? { message: result.error.message } : null,
          };
        },
      });

      if (data.length === 0) break;

      for (const item of data) {
        const path = folder ? `${folder}/${item.name}` : item.name;
        if (item.id === null) {
          await walk(path);
          continue;
        }

        results.push({
          path,
          updated_at: item.updated_at ?? null,
          size: item.metadata?.size ?? null,
        });
      }

      if (data.length < limit) break;
      offset += limit;
    }
  }

  await walk(params.prefix);
  return results;
}
