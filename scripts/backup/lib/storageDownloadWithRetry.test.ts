import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  downloadStorageObjectWithRetry,
  shouldFailStorageMirror,
  STORAGE_MIRROR_MAX_FAILURE_RATE,
} from "./storageDownloadWithRetry";

describe("shouldFailStorageMirror", () => {
  it("fails when nothing was downloaded", () => {
    assert.equal(
      shouldFailStorageMirror({
        referencedPathCount: 10,
        downloadedCount: 0,
        missingPathCount: 10,
      }),
      true,
    );
  });

  it("fails when missing paths exceed the failure rate", () => {
    assert.equal(
      shouldFailStorageMirror({
        referencedPathCount: 100,
        downloadedCount: 94,
        missingPathCount: 6,
      }),
      true,
    );
  });

  it("succeeds when missing paths are within the failure rate", () => {
    assert.equal(
      shouldFailStorageMirror({
        referencedPathCount: 100,
        downloadedCount: 96,
        missingPathCount: 4,
      }),
      false,
    );
  });

  it("uses a 5% failure threshold", () => {
    assert.equal(STORAGE_MIRROR_MAX_FAILURE_RATE, 0.05);
  });
});

describe("downloadStorageObjectWithRetry", () => {
  it("retries transient download errors", async () => {
    let calls = 0;
    const delays: number[] = [];

    const result = await downloadStorageObjectWithRetry({
      bucket: "company-logos",
      objectPath: "companies/example/logo.png",
      random: () => 0,
      sleep: async (ms) => {
        delays.push(ms);
      },
      supabase: {
        storage: {
          from: () => ({
            download: async () => {
              calls += 1;
              if (calls === 1) {
                return { data: null, error: { message: "504 Gateway Timeout" } };
              }
              return {
                data: {
                  arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
                },
                error: null,
              };
            },
          }),
        },
      } as never,
    });

    assert.equal(calls, 2);
    assert.deepEqual(delays, [1000]);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.bytes.byteLength, 3);
    }
  });

  it("does not retry permanent download errors", async () => {
    let calls = 0;

    const result = await downloadStorageObjectWithRetry({
      bucket: "company-logos",
      objectPath: "companies/example/logo.png",
      supabase: {
        storage: {
          from: () => ({
            download: async () => {
              calls += 1;
              return { data: null, error: { message: "Object not found" } };
            },
          }),
        },
      } as never,
    });

    assert.equal(calls, 1);
    assert.deepEqual(result, { ok: false, error: "Object not found" });
  });
});
