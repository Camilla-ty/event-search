import { cache } from "react";

import type { EventBrandPublicProfileSeriesCandidate } from "@/src/lib/companies/eventBrandPublicProfile";
import {
  buildPublicCompanyHref,
  type PublicCompanyDestinationCompany,
} from "@/src/lib/companies/resolvePublicCompanyDestination";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { fetchAllByIdInBatches } from "@/src/lib/supabase/fetchInBatches";

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

type ApprovedCompanyRow = {
  id: string;
  event_brand_public_profile_approved_at: string | null;
};

type SameBrandSeriesRow = {
  id: string;
  slug: string | null;
  name: string | null;
  lifecycle_status: string | null;
  company_profile_id: string | null;
};

/**
 * Loads approved Event Brand Companies and their reverse same-brand Series.
 * Approval set is intentionally small (manual allowlist); safe per request.
 */
export async function loadEventBrandPublicDestinationIndex(): Promise<EventBrandPublicDestinationIndex> {
  try {
    const admin = createAdminClient();
    const { data: approvedRows, error: approvedError } = await admin
      .from("companies")
      .select("id, event_brand_public_profile_approved_at")
      .not("event_brand_public_profile_approved_at", "is", null);

    if (approvedError) {
      if (process.env.NODE_ENV === "development") {
        console.error(
          "[event-brand] destination index approved companies failed:",
          approvedError.message,
        );
      }
      return new Map();
    }

    const approved = (approvedRows ?? []) as ApprovedCompanyRow[];
    const companyIds: string[] = [];
    const approvedAtById = new Map<string, string>();

    for (const row of approved) {
      const key = companyIdKey(row.id);
      const approvedAt =
        typeof row.event_brand_public_profile_approved_at === "string"
          ? row.event_brand_public_profile_approved_at.trim()
          : "";
      if (key === "" || approvedAt === "") continue;
      companyIds.push(row.id);
      approvedAtById.set(key, approvedAt);
    }

    if (companyIds.length === 0) {
      return new Map();
    }

    const seriesRows = (await fetchAllByIdInBatches(companyIds, (batchIds) =>
      admin
        .from("event_series")
        .select("id, slug, name, lifecycle_status, company_profile_id")
        .in("company_profile_id", batchIds),
    )) as SameBrandSeriesRow[];

    const seriesByCompanyId = new Map<string, EventBrandPublicProfileSeriesCandidate>();
    for (const row of seriesRows) {
      const key = companyIdKey(row.company_profile_id);
      if (key === "") continue;
      seriesByCompanyId.set(key, {
        id: row.id,
        slug: row.slug,
        name: row.name,
        lifecycle_status: row.lifecycle_status,
      });
    }

    const index = new Map<string, EventBrandPublicDestinationEntry>();
    for (const [key, approvedAt] of approvedAtById) {
      index.set(key, {
        approvedAt,
        series: seriesByCompanyId.get(key) ?? null,
      });
    }
    return index;
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
