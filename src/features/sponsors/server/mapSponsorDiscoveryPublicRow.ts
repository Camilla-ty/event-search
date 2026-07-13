import type {
  SponsorDiscoveryInternalResult,
  SponsorDiscoveryInternalRow,
  SponsorDiscoveryPublicEventContext,
  SponsorDiscoveryPublicRow,
  SponsorDiscoveryResult,
} from "@/src/features/sponsors/server/sponsorDiscoveryTypes";
import { formatPublicCompanyWebsite } from "@/src/lib/domain/formatPublicCompanyWebsite";
import { buildSponsorProfilePath } from "@/src/lib/routes/explorerUrls";

function readEventTierLabel(
  row: SponsorDiscoveryInternalRow,
  hasEventFilter: boolean,
): string | null {
  if (!hasEventFilter || row.event_tier === null) {
    return null;
  }

  const label = row.event_tier.tier_label?.trim() ?? "";
  return label !== "" ? label : null;
}

export function mapSponsorDiscoveryPublicRow(
  row: SponsorDiscoveryInternalRow,
  options: { hasEventFilter: boolean },
): SponsorDiscoveryPublicRow {
  const websiteDisplay = formatPublicCompanyWebsite({
    website: row.website,
    domain: row.domain,
  });
  const href =
    buildSponsorProfilePath({ slug: row.slug, id: row.id }) ?? `/sponsors/${row.id}`;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    href,
    website_label: websiteDisplay?.label ?? null,
    logo_url: row.logo_url,
    logo_source: row.logo_source,
    logo_status: row.logo_status,
    sponsored_edition_count: row.sponsored_edition_count,
    event_tier_label: readEventTierLabel(row, options.hasEventFilter),
  };
}

function mapPublicEventContext(
  internal: SponsorDiscoveryInternalResult,
): SponsorDiscoveryPublicEventContext | null {
  if (internal.eventContext === null) {
    return null;
  }

  return {
    slug: internal.eventContext.slug,
    name: internal.eventContext.name,
  };
}

export function mapSponsorDiscoveryPublicResult(
  internal: SponsorDiscoveryInternalResult,
): SponsorDiscoveryResult {
  const hasEventFilter =
    internal.params.eventSlug !== null && !internal.eventUnknown;

  return {
    rows: internal.rows.map((row) =>
      mapSponsorDiscoveryPublicRow(row, { hasEventFilter }),
    ),
    total: internal.total,
    params: internal.params,
    eventContext: mapPublicEventContext(internal),
    eventUnknown: internal.eventUnknown,
    pageWasClamped: internal.pageWasClamped,
  };
}
