import { createClient } from "@/src/lib/supabase/server";
import type { EventBrandPublicProfileSeriesCandidate } from "@/src/lib/companies/eventBrandPublicProfile";
import {
  buildPublicSameBrandCompanyLink,
  buildPublicSameBrandSeriesLink,
  type PublicSameBrandLink,
} from "@/src/lib/companies/sameBrandPublicLink";

/**
 * Load a public-safe same-brand company link for a series hub.
 * Restricted / merged / inactive companies are queried out — no names leak in the payload.
 */
export async function loadPublicSameBrandCompanyLinkForSeries(
  companyProfileId: string | null | undefined,
): Promise<PublicSameBrandLink | null> {
  const id =
    typeof companyProfileId === "string" ? companyProfileId.trim() : "";
  if (id === "") return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, slug, status, restricted_at, merged_into_company_id")
    .eq("id", id)
    .eq("status", "active")
    .is("restricted_at", null)
    .is("merged_into_company_id", null)
    .maybeSingle();

  if (error || !data) return null;
  return buildPublicSameBrandCompanyLink(data);
}

/** Raw reverse same-brand Series row for a Company (may be merged / non-public). */
export async function loadSameBrandSeriesCandidateForCompany(
  companyId: string | null | undefined,
): Promise<EventBrandPublicProfileSeriesCandidate | null> {
  const id = typeof companyId === "string" ? companyId.trim() : "";
  if (id === "") return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_series")
    .select("id, name, slug, lifecycle_status")
    .eq("company_profile_id", id)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: typeof data.id === "string" ? data.id : null,
    name: typeof data.name === "string" ? data.name : null,
    slug: typeof data.slug === "string" ? data.slug : null,
    lifecycle_status:
      typeof data.lifecycle_status === "string" ? data.lifecycle_status : null,
  };
}

/**
 * Load a public-safe same-brand Event Brand (series) link for a company profile.
 * Merged series rows are filtered by the pure builder (no destination href).
 */
export async function loadPublicSameBrandSeriesLinkForCompany(
  companyId: string | null | undefined,
): Promise<PublicSameBrandLink | null> {
  const row = await loadSameBrandSeriesCandidateForCompany(companyId);
  return buildPublicSameBrandSeriesLink(row);
}

export function readCompanyProfileIdFromSeriesRow(
  raw: unknown,
): string | null {
  if (raw === null || typeof raw !== "object") return null;
  const value = (raw as Record<string, unknown>).company_profile_id;
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}
