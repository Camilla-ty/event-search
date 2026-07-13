import type {
  SponsorDiscoveryInternalEventContext,
  SponsorDiscoveryInternalResult,
  SponsorDiscoveryInternalRow,
  SponsorDiscoveryParams,
  SponsorDiscoverySort,
} from "@/src/features/sponsors/server/sponsorDiscoveryTypes";
import { mapPublicLogoUrl } from "@/src/lib/storage/mapPublicLogoUrl";

type SponsorDiscoveryRpcRow = SponsorDiscoveryInternalRow;

function readString(raw: unknown): string | null {
  return typeof raw === "string" ? raw : null;
}

function readNullableString(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  return typeof raw === "string" ? raw : null;
}

function readInteger(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.trunc(raw);
  }
  if (typeof raw === "string" && raw.trim() !== "") {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readBoolean(raw: unknown): boolean {
  return raw === true;
}

function readSort(raw: unknown): SponsorDiscoverySort {
  const value = readString(raw)?.trim().toLowerCase();
  if (
    value === "activity" ||
    value === "name" ||
    value === "count" ||
    value === "tier"
  ) {
    return value;
  }
  return "activity";
}

function parseEventTier(
  rawRank: unknown,
  rawLabel: unknown,
): SponsorDiscoveryInternalRow["event_tier"] {
  return {
    tier_rank: readInteger(rawRank),
    tier_label: readNullableString(rawLabel),
  };
}

function parseRpcRow(
  raw: unknown,
  params: SponsorDiscoveryParams,
  eventUnknown: boolean,
): SponsorDiscoveryRpcRow | null {
  if (raw === null || typeof raw !== "object") return null;

  const row = raw as Record<string, unknown>;
  const id = readString(row.id)?.trim() ?? "";
  const slug = readString(row.slug)?.trim() ?? "";
  const name = readString(row.name)?.trim() ?? "";
  const sponsoredEditionCount = readInteger(row.sponsored_edition_count);

  if (id === "" || slug === "" || name === "" || sponsoredEditionCount === null) {
    return null;
  }

  const hasEventFilter = params.eventSlug !== null && !eventUnknown;

  return {
    id,
    slug,
    name,
    domain: readNullableString(row.domain),
    website: readNullableString(row.website),
    logo_url: mapPublicLogoUrl(readNullableString(row.logo_url)),
    logo_source: readNullableString(row.logo_source),
    logo_status: readNullableString(row.logo_status),
    short_description: readNullableString(row.short_description),
    sponsored_edition_count: sponsoredEditionCount,
    latest_activity_at: readNullableString(row.latest_activity_at),
    event_tier: hasEventFilter
      ? parseEventTier(row.tier_rank, row.tier_label)
      : null,
  };
}

function parseEventContext(
  raw: unknown,
  params: SponsorDiscoveryParams,
  eventUnknown: boolean,
): SponsorDiscoveryInternalEventContext | null {
  if (params.eventSlug === null) {
    return null;
  }

  if (eventUnknown) {
    return {
      slug: params.eventSlug,
      id: null,
      name: null,
    };
  }

  if (raw === null || typeof raw !== "object") {
    return {
      slug: params.eventSlug,
      id: null,
      name: null,
    };
  }

  const event = raw as Record<string, unknown>;
  const slug = readString(event.slug)?.trim() ?? params.eventSlug;
  const id = readString(event.id)?.trim() ?? null;
  const name = readNullableString(event.name);

  return { slug, id, name };
}

export function mapSponsorDiscoveryRpcResponse(
  raw: unknown,
  params: SponsorDiscoveryParams,
): SponsorDiscoveryInternalResult {
  if (raw === null || typeof raw !== "object") {
    return {
      rows: [],
      total: 0,
      params,
      eventContext: parseEventContext(null, params, false),
      eventUnknown: false,
    };
  }

  const payload = raw as Record<string, unknown>;
  const eventUnknown = readBoolean(payload.event_unknown);
  const rowsRaw = Array.isArray(payload.rows) ? payload.rows : [];
  const rows: SponsorDiscoveryInternalRow[] = [];

  for (const rowRaw of rowsRaw) {
    const parsed = parseRpcRow(rowRaw, params, eventUnknown);
    if (parsed === null) continue;
    rows.push(parsed);
  }

  const total = readInteger(payload.total) ?? 0;
  const page = readInteger(payload.page) ?? params.page;
  const pageSize = readInteger(payload.page_size) ?? params.pageSize;
  const sort = readSort(payload.sort);

  return {
    rows,
    total,
    params: {
      ...params,
      page,
      pageSize,
      sort,
    },
    eventContext: parseEventContext(payload.event, params, eventUnknown),
    eventUnknown,
  };
}
