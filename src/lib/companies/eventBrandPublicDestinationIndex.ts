import { cache } from "react";

import type { EventBrandPublicProfileSeriesCandidate } from "@/src/lib/companies/eventBrandPublicProfile";
import {
  buildPublicCompanyHref,
  type PublicCompanyDestinationCompany,
} from "@/src/lib/companies/resolvePublicCompanyDestination";
import { createClient } from "@/src/lib/supabase/server";

/** Stable map key for UUID company ids. */
function companyIdKey(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  return String(raw).trim().toLowerCase();
}

export type EventBrandPublicDestinationEntry = {
  approvedAt: string;
  series: EventBrandPublicProfileSeriesCandidate | null;
};

/** Approved Event Brand Companies → reverse same-brand Series (ADR-005 EB4). */
export type EventBrandPublicDestinationIndex = ReadonlyMap<
  string,
  EventBrandPublicDestinationEntry
>;

export type PublicCompanyRoleHrefCompany = PublicCompanyDestinationCompany & {
  /** Server-attached resolved href; `null` means non-linkable. */
  public_href?: string | null;
};

/** Row shape from `event_brand_public_destinations` (ARC-001 Phase 4). */
export type EventBrandPublicDestinationRow = {
  company_id?: unknown;
  approved_at?: unknown;
  series_id?: unknown;
  series_slug?: unknown;
  series_name?: unknown;
  series_lifecycle_status?: unknown;
};

function trimString(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed !== "" ? trimmed : null;
}

/**
 * Build the destination index from public aggregate view rows.
 * Exported for focused regression tests (ARC-001 Phase 4).
 */
export function buildEventBrandPublicDestinationIndexFromRows(
  rows: readonly EventBrandPublicDestinationRow[],
): EventBrandPublicDestinationIndex {
  const index = new Map<string, EventBrandPublicDestinationEntry>();

  for (const row of rows) {
    const key = companyIdKey(row.company_id);
    const approvedAt = trimString(row.approved_at);
    if (key === "" || approvedAt === null) continue;

    const seriesId = trimString(row.series_id);
    const series: EventBrandPublicProfileSeriesCandidate | null =
      seriesId === null
        ? null
        : {
            id: seriesId,
            slug: trimString(row.series_slug),
            name: trimString(row.series_name),
            lifecycle_status: trimString(row.series_lifecycle_status),
          };

    index.set(key, {
      approvedAt,
      series,
    });
  }

  return index;
}

/**
 * Loads approved Event Brand Companies and their reverse same-brand Series.
 * Reads `event_brand_public_destinations` via the session client (no service_role).
 * Approval set is intentionally small (manual allowlist); safe per request.
 */
export async function loadEventBrandPublicDestinationIndex(): Promise<EventBrandPublicDestinationIndex> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("event_brand_public_destinations")
      .select(
        "company_id, approved_at, series_id, series_slug, series_name, series_lifecycle_status",
      );

    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.error(
          "[event-brand] destination index load failed:",
          error.message,
        );
      }
      return new Map();
    }

    return buildEventBrandPublicDestinationIndexFromRows(
      (data ?? []) as EventBrandPublicDestinationRow[],
    );
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[event-brand] destination index load failed:", error);
    }
    return new Map();
  }
}

/** Dedupes index loads within a single React server request. */
export const getEventBrandPublicDestinationIndex = cache(
  loadEventBrandPublicDestinationIndex,
);

/**
 * Public role-surface href via EB1 resolver + optional destination index.
 * Prefers server-attached `public_href` when present.
 */
export function buildPublicCompanyRoleHref(
  company: PublicCompanyRoleHrefCompany | null | undefined,
  index?: EventBrandPublicDestinationIndex | null,
): string | null {
  if (company === null || company === undefined) return null;

  if (typeof company.public_href === "string") {
    const trimmed = company.public_href.trim();
    return trimmed !== "" ? trimmed : null;
  }
  if (company.public_href === null) return null;

  const key = companyIdKey(company.id);
  const entry = key !== "" && index ? index.get(key) : undefined;

  return buildPublicCompanyHref({
    company: {
      ...company,
      event_brand_public_profile_approved_at:
        company.event_brand_public_profile_approved_at ??
        entry?.approvedAt ??
        null,
    },
    sameBrandSeries: entry?.series ?? null,
  });
}

/** Attach resolved `public_href` for client-safe rendering without the index. */
export function withPublicCompanyRoleHref<T extends PublicCompanyDestinationCompany>(
  company: T,
  index: EventBrandPublicDestinationIndex,
): T & { public_href: string | null } {
  return {
    ...company,
    public_href: buildPublicCompanyRoleHref(company, index),
  };
}
