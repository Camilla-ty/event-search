import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertSafeOutboundHttpUrl,
  isBlockedHostname,
  isBlockedIpAddress,
  isBlockedIpv4Address,
  isBlockedIpv6Address,
  type SafeOutboundLookupFn,
} from "./safeOutboundUrl";

const publicLookup: SafeOutboundLookupFn = async () => [
  { address: "93.184.216.34", family: 4 },
];

describe("isBlockedIpv4Address", () => {
  it("rejects loopback, RFC1918, link-local, and metadata", () => {
    assert.equal(isBlockedIpv4Address("127.0.0.1"), true);
    assert.equal(isBlockedIpv4Address("127.1.2.3"), true);
    assert.equal(isBlockedIpv4Address("10.0.0.1"), true);
    assert.equal(isBlockedIpv4Address("172.16.0.1"), true);
    assert.equal(isBlockedIpv4Address("172.31.255.255"), true);
    assert.equal(isBlockedIpv4Address("192.168.1.1"), true);
    assert.equal(isBlockedIpv4Address("169.254.1.1"), true);
    assert.equal(isBlockedIpv4Address("169.254.169.254"), true);
    assert.equal(isBlockedIpv4Address("0.0.0.0"), true);
  });

  it("allows public addresses and non-private 172.x", () => {
    assert.equal(isBlockedIpv4Address("1.1.1.1"), false);
    assert.equal(isBlockedIpv4Address("8.8.8.8"), false);
    assert.equal(isBlockedIpv4Address("172.15.0.1"), false);
    assert.equal(isBlockedIpv4Address("172.32.0.1"), false);
  });
});

describe("isBlockedIpv6Address", () => {
  it("rejects loopback, link-local, ULA, and IPv4-mapped private", () => {
    assert.equal(isBlockedIpv6Address("::1"), true);
    assert.equal(isBlockedIpv6Address("fe80::1"), true);
    assert.equal(isBlockedIpv6Address("fc00::1"), true);
    assert.equal(isBlockedIpv6Address("fd12:3456:789a::1"), true);
    assert.equal(isBlockedIpv6Address("::ffff:127.0.0.1"), true);
    assert.equal(isBlockedIpv6Address("::ffff:10.0.0.1"), true);
    assert.equal(isBlockedIpv6Address("::ffff:169.254.169.254"), true);
  });

  it("allows public IPv6", () => {
    assert.equal(isBlockedIpv6Address("2001:4860:4860::8888"), false);
  });
});

describe("isBlockedHostname / isBlockedIpAddress", () => {
  it("rejects localhost variants", () => {
    assert.equal(isBlockedHostname("localhost"), true);
    assert.equal(isBlockedHostname("Foo.Localhost"), true);
    assert.equal(isBlockedHostname("printer.local"), true);
    assert.equal(isBlockedHostname("metadata.google.internal"), true);
  });

  it("allows normal public hostnames", () => {
    assert.equal(isBlockedHostname("example.com"), false);
    assert.equal(isBlockedHostname("img.logo.dev"), false);
  });

  it("delegates IP literals", () => {
    assert.equal(isBlockedIpAddress("192.168.0.1"), true);
    assert.equal(isBlockedIpAddress("8.8.4.4"), false);
  });
});

describe("assertSafeOutboundHttpUrl", () => {
  it("rejects empty, non-http, and credentialed URLs", async () => {
    assert.equal((await assertSafeOutboundHttpUrl("")).ok, false);
    assert.equal((await assertSafeOutboundHttpUrl("ftp://example.com/a")).ok, false);
    const creds = await assertSafeOutboundHttpUrl("https://user:pass@example.com/");
    assert.equal(creds.ok, false);
    if (!creds.ok) assert.equal(creds.reason, "credentials_forbidden");
  });

  it("rejects localhost and loopback literals without DNS", async () => {
    const localhost = await assertSafeOutboundHttpUrl("http://localhost/logo.png");
    assert.equal(localhost.ok, false);
    if (!localhost.ok) assert.equal(localhost.reason, "blocked_hostname");

    const loopback = await assertSafeOutboundHttpUrl("https://127.0.0.1/favicon.ico");
    assert.equal(loopback.ok, false);
    if (!loopback.ok) assert.equal(loopback.reason, "blocked_ip");

    const v6 = await assertSafeOutboundHttpUrl("http://[::1]/");
    assert.equal(v6.ok, false);
    if (!v6.ok) assert.equal(v6.reason, "blocked_ip");
  });

  it("rejects RFC1918, link-local, and cloud metadata literals", async () => {
    for (const url of [
      "https://10.1.2.3/a.png",
      "https://172.20.0.5/a.png",
      "https://192.168.100.2/a.png",
      "http://169.254.169.254/latest/meta-data/",
    ]) {
      const result = await assertSafeOutboundHttpUrl(url);
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.reason, "blocked_ip");
    }
  });

  it("rejects hostnames that resolve to blocked IPs", async () => {
    const lookupFn: SafeOutboundLookupFn = async () => [
      { address: "127.0.0.1", family: 4 },
    ];
    const result = await assertSafeOutboundHttpUrl("https://evil.example/logo.png", {
      lookupFn,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "blocked_resolved_ip");
  });

  it("rejects DNS lookup failures (fail closed)", async () => {
    const lookupFn: SafeOutboundLookupFn = async () => {
      throw new Error("ENOTFOUND");
    };
    const result = await assertSafeOutboundHttpUrl("https://missing.example/", { lookupFn });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "dns_lookup_failed");
  });

  it("allows public hostnames that resolve to public IPs", async () => {
    const result = await assertSafeOutboundHttpUrl("https://example.com/path/logo.webp", {
      lookupFn: publicLookup,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.url.hostname, "example.com");
      assert.match(result.normalized, /^https:\/\/example\.com\/path\/logo\.webp/);
    }
  });

  it("allows Logo.dev image host when DNS is public", async () => {
    const result = await assertSafeOutboundHttpUrl(
      "https://img.logo.dev/acme.com?token=x&fallback=404",
      { lookupFn: publicLookup },
    );
    assert.equal(result.ok, true);
  });

  it("allows Google favicon host when DNS is public", async () => {
    const result = await assertSafeOutboundHttpUrl(
      "https://www.google.com/s2/favicons?domain=127.0.0.1&sz=128",
      { lookupFn: publicLookup },
    );
    assert.equal(result.ok, true);
  });
});
