import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

export type SafeOutboundUrlReason =
  | "empty"
  | "invalid_url"
  | "unsupported_protocol"
  | "missing_hostname"
  | "credentials_forbidden"
  | "blocked_hostname"
  | "blocked_ip"
  | "dns_lookup_failed"
  | "blocked_resolved_ip";

export type SafeOutboundUrlResult =
  | { ok: true; url: URL; normalized: string }
  | { ok: false; reason: SafeOutboundUrlReason };

export type SafeOutboundLookupFn = (
  hostname: string,
) => Promise<ReadonlyArray<{ address: string; family: number }>>;

export type AssertSafeOutboundHttpUrlOptions = {
  /** Injected for tests; defaults to Node DNS lookup (all records). */
  lookupFn?: SafeOutboundLookupFn;
};

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.goog",
]);

async function defaultLookup(
  hostname: string,
): Promise<ReadonlyArray<{ address: string; family: number }>> {
  return dnsLookup(hostname, { all: true, verbatim: true });
}

function parseIpv4Octets(ip: string): [number, number, number, number] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    octets.push(n);
  }
  return octets as [number, number, number, number];
}

/** True for loopback, RFC1918, link-local, and cloud-metadata IPv4 addresses. */
export function isBlockedIpv4Address(ip: string): boolean {
  const octets = parseIpv4Octets(ip);
  if (!octets) return false;
  const [a, b] = octets;

  // Loopback 127.0.0.0/8
  if (a === 127) return true;
  // "This" network 0.0.0.0/8
  if (a === 0) return true;
  // RFC1918
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  // Link-local 169.254.0.0/16 (includes cloud metadata 169.254.169.254)
  if (a === 169 && b === 254) return true;

  return false;
}

function expandIpv6ForCompare(ip: string): string | null {
  const trimmed = ip.trim().toLowerCase();
  if (!trimmed || isIP(trimmed) !== 6) return null;

  let head = trimmed;
  let zone = "";
  const zoneIdx = trimmed.indexOf("%");
  if (zoneIdx >= 0) {
    head = trimmed.slice(0, zoneIdx);
    zone = trimmed.slice(zoneIdx);
  }

  if (head.includes(".")) {
    // IPv4-mapped / IPv4-compatible forms handled separately.
    return null;
  }

  const sides = head.split("::");
  if (sides.length > 2) return null;

  const left = sides[0] ? sides[0].split(":") : [];
  const right = sides.length === 2 && sides[1] ? sides[1].split(":") : [];
  if (sides.length === 1) {
    if (left.length !== 8) return null;
  } else {
    const missing = 8 - (left.length + right.length);
    if (missing < 0) return null;
    const filled = [...left, ...Array.from({ length: missing }, () => "0"), ...right];
    head = filled.join(":");
  }

  const groups = head.split(":");
  if (groups.length !== 8) return null;
  const padded: string[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    padded.push(g.padStart(4, "0"));
  }
  return `${padded.join(":")}${zone}`;
}

function ipv4MappedFromIpv6(ip: string): string | null {
  const lower = ip.trim().toLowerCase();
  const mapped = lower.match(/^:?:ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped?.[1]) return mapped[1];

  const expanded = expandIpv6ForCompare(lower);
  if (!expanded) return null;
  // ::ffff:0:0/96 → last 32 bits as IPv4 when first 80 bits zero and next 16 are ffff
  const groups = expanded.split("%")[0]?.split(":") ?? [];
  if (groups.length !== 8) return null;
  const prefix = groups.slice(0, 5).join("");
  if (prefix !== "00000000000000000000" || groups[5] !== "ffff") return null;
  const hi = Number.parseInt(groups[6]!, 16);
  const lo = Number.parseInt(groups[7]!, 16);
  return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
}

/** True for loopback, ULA, link-local, and IPv4-mapped blocked addresses. */
export function isBlockedIpv6Address(ip: string): boolean {
  const mapped = ipv4MappedFromIpv6(ip);
  if (mapped) return isBlockedIpv4Address(mapped);

  const expanded = expandIpv6ForCompare(ip);
  if (!expanded) {
    // Fall back for forms expand couldn't normalize.
    const lower = ip.trim().toLowerCase();
    if (lower === "::1" || lower.startsWith("::1%")) return true;
    if (lower.startsWith("fe80:")) return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    return false;
  }

  const bare = expanded.split("%")[0]!;
  // Loopback ::1
  if (bare === "0000:0000:0000:0000:0000:0000:0000:0001") return true;
  // Unspecified ::
  if (bare === "0000:0000:0000:0000:0000:0000:0000:0000") return true;
  // Link-local fe80::/10
  const g0 = Number.parseInt(bare.slice(0, 4), 16);
  if ((g0 & 0xffc0) === 0xfe80) return true;
  // Unique local fc00::/7
  if ((g0 & 0xfe00) === 0xfc00) return true;

  return false;
}

export function isBlockedIpAddress(ip: string): boolean {
  const family = isIP(ip.trim());
  if (family === 4) return isBlockedIpv4Address(ip.trim());
  if (family === 6) return isBlockedIpv6Address(ip.trim());
  return false;
}

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!host) return true;
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host.endsWith(".localhost")) return true;
  if (host.endsWith(".local")) return true;
  return false;
}

function normalizeHostname(hostname: string): string {
  const trimmed = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Assert an http(s) URL is safe for server-side outbound fetch (SEC-003).
 * Rejects localhost, loopback, RFC1918, link-local, and cloud-metadata destinations
 * on the hostname (when an IP literal) and on DNS-resolved addresses.
 */
export async function assertSafeOutboundHttpUrl(
  value: string,
  options?: AssertSafeOutboundHttpUrlOptions,
): Promise<SafeOutboundUrlResult> {
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, reason: "empty" };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: "unsupported_protocol" };
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (!hostname) return { ok: false, reason: "missing_hostname" };

  if (parsed.username !== "" || parsed.password !== "") {
    return { ok: false, reason: "credentials_forbidden" };
  }

  if (isBlockedHostname(hostname)) {
    return { ok: false, reason: "blocked_hostname" };
  }

  const literalFamily = isIP(hostname);
  if (literalFamily === 4 || literalFamily === 6) {
    if (isBlockedIpAddress(hostname)) {
      return { ok: false, reason: "blocked_ip" };
    }
    return { ok: true, url: parsed, normalized: parsed.toString() };
  }

  const lookupFn = options?.lookupFn ?? defaultLookup;
  let records: ReadonlyArray<{ address: string; family: number }>;
  try {
    records = await lookupFn(hostname);
  } catch {
    return { ok: false, reason: "dns_lookup_failed" };
  }

  if (!records.length) {
    return { ok: false, reason: "dns_lookup_failed" };
  }

  for (const record of records) {
    if (isBlockedIpAddress(record.address)) {
      return { ok: false, reason: "blocked_resolved_ip" };
    }
  }

  return { ok: true, url: parsed, normalized: parsed.toString() };
}
