import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { safeOutboundFetch, type SafeOutboundFetchFn } from "./safeOutboundFetch";
import type { SafeOutboundLookupFn } from "./safeOutboundUrl";

const publicLookup: SafeOutboundLookupFn = async () => [
  { address: "93.184.216.34", family: 4 },
];

function redirectResponse(status: number, location: string): Response {
  return new Response(null, {
    status,
    headers: { location },
  });
}

function okResponse(body = "ok"): Response {
  return new Response(body, { status: 200, headers: { "content-type": "text/plain" } });
}

describe("safeOutboundFetch redirect safety", () => {
  it("allows public → public redirects", async () => {
    const calls: string[] = [];
    const fetchFn: SafeOutboundFetchFn = async (input) => {
      calls.push(String(input));
      if (calls.length === 1) {
        return redirectResponse(302, "https://cdn.example/logo.png");
      }
      return okResponse("image");
    };

    const response = await safeOutboundFetch("https://example.com/start", {
      fetchFn,
      lookupFn: publicLookup,
    });

    assert.ok(response);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "image");
    assert.deepEqual(calls, [
      "https://example.com/start",
      "https://cdn.example/logo.png",
    ]);
  });

  it("blocks public → localhost", async () => {
    const fetchFn: SafeOutboundFetchFn = async () =>
      redirectResponse(302, "http://localhost/secret");

    const response = await safeOutboundFetch("https://example.com/start", {
      fetchFn,
      lookupFn: publicLookup,
    });

    assert.equal(response, null);
  });

  it("blocks public → 127.0.0.1", async () => {
    const fetchFn: SafeOutboundFetchFn = async () =>
      redirectResponse(301, "http://127.0.0.1/favicon.ico");

    const response = await safeOutboundFetch("https://example.com/start", {
      fetchFn,
      lookupFn: publicLookup,
    });

    assert.equal(response, null);
  });

  it("blocks public → 169.254.169.254", async () => {
    const fetchFn: SafeOutboundFetchFn = async () =>
      redirectResponse(302, "http://169.254.169.254/latest/meta-data/");

    const response = await safeOutboundFetch("https://example.com/start", {
      fetchFn,
      lookupFn: publicLookup,
    });

    assert.equal(response, null);
  });

  it("blocks public → private RFC1918", async () => {
    for (const location of [
      "http://10.0.0.8/logo.png",
      "http://172.16.5.1/logo.png",
      "http://192.168.1.50/logo.png",
    ]) {
      const fetchFn: SafeOutboundFetchFn = async () => redirectResponse(307, location);
      const response = await safeOutboundFetch("https://example.com/start", {
        fetchFn,
        lookupFn: publicLookup,
      });
      assert.equal(response, null, `expected block for ${location}`);
    }
  });

  it("blocks when a later hop resolves to a private IP", async () => {
    const lookupFn: SafeOutboundLookupFn = async (hostname) => {
      if (hostname === "evil.internal") {
        return [{ address: "10.1.2.3", family: 4 }];
      }
      return [{ address: "93.184.216.34", family: 4 }];
    };

    const fetchFn: SafeOutboundFetchFn = async () =>
      redirectResponse(302, "https://evil.internal/logo.png");

    const response = await safeOutboundFetch("https://example.com/start", {
      fetchFn,
      lookupFn,
    });

    assert.equal(response, null);
  });

  it("resolves relative Location against the current URL", async () => {
    const calls: string[] = [];
    const fetchFn: SafeOutboundFetchFn = async (input) => {
      calls.push(String(input));
      if (calls.length === 1) {
        return redirectResponse(302, "/final.png");
      }
      return okResponse("rel");
    };

    const response = await safeOutboundFetch("https://example.com/assets/start", {
      fetchFn,
      lookupFn: publicLookup,
    });

    assert.ok(response);
    assert.deepEqual(calls, [
      "https://example.com/assets/start",
      "https://example.com/final.png",
    ]);
  });
});
