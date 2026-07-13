const SPONSOR_DISCOVERY_RPC_ROW_FORBIDDEN_KEYS = [
  "short_description",
  "tier_rank",
  "tier_label",
] as const;

const SPONSOR_DISCOVERY_RPC_ROW_ALLOWED_KEYS = [
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

export function assertSponsorDiscoveryRpcPublicRowShape(row: Record<string, unknown>): void {
  const keys = Object.keys(row);
  const forbidden = keys.filter((key) =>
    (SPONSOR_DISCOVERY_RPC_ROW_FORBIDDEN_KEYS as readonly string[]).includes(key),
  );
  if (forbidden.length > 0) {
    throw new Error(`Forbidden RPC row keys present: ${forbidden.join(", ")}`);
  }

  const unexpected = keys.filter(
    (key) => !(SPONSOR_DISCOVERY_RPC_ROW_ALLOWED_KEYS as readonly string[]).includes(key),
  );
  if (unexpected.length > 0) {
    throw new Error(`Unexpected RPC row keys present: ${unexpected.join(", ")}`);
  }
}

export function assertSponsorDiscoveryRpcPublicEventShape(
  event: Record<string, unknown> | null,
): void {
  if (event === null) return;
  if ("id" in event) {
    throw new Error("Forbidden event.id present in RPC payload");
  }
}
