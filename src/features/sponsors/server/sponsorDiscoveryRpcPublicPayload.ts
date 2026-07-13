import assert from "node:assert/strict";
import { describe, it } from "node:test";

/** Allowed keys on sponsor_discovery_page RPC rows after P4A. */
export const SPONSOR_DISCOVERY_RPC_ROW_PUBLIC_KEYS = [
  "id",
  "name",
  "slug",
  "domain",
  "website",
  "logo_url",
  "logo_source",
  "logo_status",
  "sponsored_edition_count",
  "latest_activity_at",
  "event_tier_label",
] as const;

/** Keys that must not appear on direct RPC rows (P4A). */
export const SPONSOR_DISCOVERY_RPC_ROW_REMOVED_KEYS = [
  "short_description",
  "tier_rank",
  "tier_label",
] as const;

export function assertSponsorDiscoveryRpcRowShape(row: Record<string, unknown>): void {
  const keys = Object.keys(row).sort();
  assert.deepEqual(keys, [...SPONSOR_DISCOVERY_RPC_ROW_PUBLIC_KEYS].sort());

  for (const removed of SPONSOR_DISCOVERY_RPC_ROW_REMOVED_KEYS) {
    assert.equal(removed in row, false, `unexpected RPC field: ${removed}`);
  }
}

export function assertSponsorDiscoveryRpcEventShape(
  event: Record<string, unknown> | null,
): void {
  if (event === null) {
    return;
  }

  assert.equal("id" in event, false);
  if ("slug" in event) {
    assert.equal(typeof event.slug, "string");
  }
  if ("name" in event) {
    assert.ok(event.name === null || typeof event.name === "string");
  }
}
