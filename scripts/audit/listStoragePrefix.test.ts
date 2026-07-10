import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  STORAGE_LIST_MAX_ATTEMPTS,
  isRetryableStorageListError,
  listStorageObjectsUnderPrefix,
  listStoragePageWithRetry,
  storageListRetryDelayMs,
} from "./listStoragePrefix";

describe("isRetryableStorageListError", () => {
  it("treats transient HTTP and network errors as retryable", () => {
    const retryable = [
      "429 Too Many Requests",
      "502 Bad Gateway",
      "503 Service Unavailable",
      "504 Gateway Timeout",
      "Gateway Timeout",
      "request timeout exceeded",
      "read ECONNRESET",
      "TypeError: fetch failed",
    ];

    for (const message of retryable) {
      assert.equal(isRetryableStorageListError(message), true, message);
    }
  });

  it("treats permanent auth and validation errors as non-retryable", () => {
    const nonRetryable = [
      "Invalid API key",
      "JWT expired",
      "Bucket not found",
      "Object not found",
      "permission denied for bucket company-logos",
      "400 Bad Request",
      "401 Unauthorized",
      "403 Forbidden",
    ];

    for (const message of nonRetryable) {
      assert.equal(isRetryableStorageListError(message), false, message);
    }
  });
});

describe("storageListRetryDelayMs", () => {
  it("uses 1s, 2s, 4s, and 8s backoff with jitter", () => {
    assert.equal(storageListRetryDelayMs(1, () => 0), 1000);
    assert.equal(storageListRetryDelayMs(2, () => 0), 2000);
    assert.equal(storageListRetryDelayMs(3, () => 0), 4000);
    assert.equal(storageListRetryDelayMs(4, () => 0), 8000);
    assert.equal(storageListRetryDelayMs(5, () => 0), 8000);
    assert.equal(storageListRetryDelayMs(1, () => 0.5), 1125);
  });
});

describe("listStoragePageWithRetry", () => {
  it("returns data after retrying a transient error", async () => {
    let calls = 0;
    const delays: number[] = [];
    const logs: string[] = [];

    const data = await listStoragePageWithRetry({
      folder: "companies/example",
      prefix: "",
      random: () => 0,
      sleep: async (ms) => {
        delays.push(ms);
      },
      logRetry: (message) => {
        logs.push(message);
      },
      list: async () => {
        calls += 1;
        if (calls === 1) {
          return { data: null, error: { message: "504 Gateway Timeout" } };
        }
        return {
          data: [{ name: "logo.png", id: "obj-1", updated_at: null, metadata: { size: 10 } }],
          error: null,
        };
      },
    });

    assert.equal(calls, 2);
    assert.deepEqual(delays, [1000]);
    assert.equal(logs.length, 1);
    assert.match(logs[0]!, /retry attempt 2\/5 for companies\/example delaying 1000ms/);
    assert.equal(data.length, 1);
  });

  it("fails immediately on a non-retryable error", async () => {
    let calls = 0;

    await assert.rejects(
      () =>
        listStoragePageWithRetry({
          folder: "companies/example",
          prefix: "",
          sleep: async () => {},
          list: async () => {
            calls += 1;
            return { data: null, error: { message: "Bucket not found" } };
          },
        }),
      /\[storage-list\] list failed for companies\/example: Bucket not found/,
    );

    assert.equal(calls, 1);
  });

  it("hard-fails after max retries on retryable errors", async () => {
    let calls = 0;
    const delays: number[] = [];

    await assert.rejects(
      () =>
        listStoragePageWithRetry({
          folder: "companies/example",
          prefix: "",
          random: () => 0,
          sleep: async (ms) => {
            delays.push(ms);
          },
          list: async () => {
            calls += 1;
            return { data: null, error: { message: "504 Gateway Timeout" } };
          },
        }),
      /\[storage-list\] list failed for companies\/example: 504 Gateway Timeout/,
    );

    assert.equal(calls, STORAGE_LIST_MAX_ATTEMPTS);
    assert.deepEqual(delays, [1000, 2000, 4000, 8000]);
  });
});

describe("listStorageObjectsUnderPrefix", () => {
  it("retries folder listing without skipping prefixes", async () => {
    let folderListCalls = 0;

    const supabase = {
      storage: {
        from: () => ({
          list: async (folder: string) => {
            if (folder === "companies/example") {
              folderListCalls += 1;
              if (folderListCalls === 1) {
                return { data: null, error: { message: "Gateway Timeout" } };
              }
              return {
                data: [{ name: "logo.png", id: "obj-1", updated_at: null, metadata: { size: 42 } }],
                error: null,
              };
            }

            if (folder === "") {
              return {
                data: [{ name: "companies", id: null, updated_at: null, metadata: null }],
                error: null,
              };
            }

            if (folder === "companies") {
              return {
                data: [{ name: "example", id: null, updated_at: null, metadata: null }],
                error: null,
              };
            }

            return { data: [], error: null };
          },
        }),
      },
    };

    const objects = await listStorageObjectsUnderPrefix({
      supabase: supabase as never,
      bucket: "company-logos",
      prefix: "",
      sleep: async () => {},
    });

    assert.equal(folderListCalls, 2);
    assert.deepEqual(objects, [
      {
        path: "companies/example/logo.png",
        updated_at: null,
        size: 42,
      },
    ]);
  });
});
