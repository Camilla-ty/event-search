import type { EventSponsorCompany } from "@/src/features/events/components/detail/types";
import {
  getEventBrandPublicDestinationIndex,
  withPublicCompanyRoleHref,
} from "@/src/lib/companies/eventBrandPublicDestinationIndex";
import { mapPublicLogoUrl } from "@/src/lib/storage/mapPublicLogoUrl";
import { createClient } from "@/src/lib/supabase/server";
import { fetchAllPaginatedSupabaseRows } from "@/src/lib/supabase/fetchAllPaginatedRows";

export type PublicPartnerAlumniMember = {
  id: string;
  display_order: number;
  company: EventSponsorCompany | null;
};

/** Current Partner Alumni version exposed on public edition pages. */
export type PublicPartnerAlumniCurrentVersion = {
  recognition_label: string | null;
  primary_source_url: string | null;
  source_checked_at: string | null;
  members: PublicPartnerAlumniMember[];
};

/** Row from `event_partner_alumni_public_versions`. */
export type PublicPartnerAlumniVersionRow = {
  event_series_id?: unknown;
  recognition_label?: unknown;
  primary_source_url?: unknown;
  source_checked_at?: unknown;
};

/** Row from `event_partner_alumni_public_members`. */
export type PublicPartnerAlumniMemberRow = {
  event_series_id?: unknown;
  member_id?: unknown;
  display_order?: unknown;
  company_id?: unknown;
  company_name?: unknown;
  company_slug?: unknown;
  company_domain?: unknown;
  company_website?: unknown;
  company_logo_url?: unknown;
  company_logo_source?: unknown;
  company_logo_status?: unknown;
  company_restricted_at?: unknown;
  company_event_brand_public_profile_approved_at?: unknown;
};

function asNullableString(raw: unknown): string | null {
  return typeof raw === "string" ? raw : null;
}

function mapPublicMemberCompany(
  row: PublicPartnerAlumniMemberRow,
): EventSponsorCompany | null {
  const id = asNullableString(row.company_id);
  if (!id) return null;

  return {
    id,
    slug: asNullableString(row.company_slug),
    name: asNullableString(row.company_name),
    domain: asNullableString(row.company_domain),
    website: asNullableString(row.company_website),
    logo_url: mapPublicLogoUrl(asNullableString(row.company_logo_url)),
    logo_source: asNullableString(row.company_logo_source),
    logo_status: asNullableString(row.company_logo_status),
    restricted_at: asNullableString(row.company_restricted_at),
    event_brand_public_profile_approved_at: asNullableString(
      row.company_event_brand_public_profile_approved_at,
    ),
  };
}

/**
 * Map public member view rows into sorted roster members.
 * Exported for focused regression tests (ARC-001 Phase 5).
 */
export function mapPublicPartnerAlumniMemberRows(
  rows: readonly PublicPartnerAlumniMemberRow[],
): PublicPartnerAlumniMember[] {
  const members: PublicPartnerAlumniMember[] = [];

  for (const row of rows) {
    const id = asNullableString(row.member_id);
    if (!id) continue;

    const displayOrder =
      typeof row.display_order === "number" && Number.isFinite(row.display_order)
        ? Math.trunc(row.display_order)
        : Number.MAX_SAFE_INTEGER;

    members.push({
      id,
      display_order: displayOrder,
      company: mapPublicMemberCompany(row),
    });
  }

  members.sort((a, b) => {
    if (a.display_order !== b.display_order) {
      return a.display_order - b.display_order;
    }
    return a.id.localeCompare(b.id);
  });

  return members;
}

/**
 * Legacy mapper for embed-shaped rows (`companies` nest). Kept for tests that
 * still exercise the previous member payload shape.
 */
export function mapPublicPartnerAlumniMembers(
  rows: readonly unknown[],
): PublicPartnerAlumniMember[] {
  const members: PublicPartnerAlumniMember[] = [];

  for (const item of rows) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const id =
      typeof record.id === "string"
        ? record.id
        : record.id != null
          ? String(record.id)
          : null;
    if (!id) continue;

    const displayOrder =
      typeof record.display_order === "number"
        ? record.display_order
        : Number.MAX_SAFE_INTEGER;

    const companyRaw = record.companies;
    let company: EventSponsorCompany | null = null;
    if (companyRaw && typeof companyRaw === "object" && !Array.isArray(companyRaw)) {
      const row = companyRaw as Record<string, unknown>;
      const companyId =
        typeof row.id === "string" ? row.id : row.id != null ? String(row.id) : null;
      if (companyId) {
        company = {
          id: companyId,
          slug: asNullableString(row.slug),
          name: asNullableString(row.name),
          domain: asNullableString(row.domain),
          website: asNullableString(row.website),
          logo_url: mapPublicLogoUrl(asNullableString(row.logo_url)),
          logo_source: asNullableString(row.logo_source),
          logo_status: asNullableString(row.logo_status),
          restricted_at: asNullableString(row.restricted_at),
          event_brand_public_profile_approved_at: asNullableString(
            row.event_brand_public_profile_approved_at,
          ),
        };
      }
    }

    members.push({
      id,
      display_order: displayOrder,
      company,
    });
  }

  members.sort((a, b) => {
    if (a.display_order !== b.display_order) {
      return a.display_order - b.display_order;
    }
    return a.id.localeCompare(b.id);
  });

  return members;
}

/** Assemble the public current-version payload (or null when empty / unusable). */
export function assemblePublicPartnerAlumniCurrentVersion(
  version: PublicPartnerAlumniVersionRow | null | undefined,
  memberRows: readonly PublicPartnerAlumniMemberRow[],
  attachHref: (company: EventSponsorCompany) => EventSponsorCompany,
): PublicPartnerAlumniCurrentVersion | null {
  if (!version) return null;

  const members = mapPublicPartnerAlumniMemberRows(memberRows).map((member) => ({
    ...member,
    company: member.company ? attachHref(member.company) : null,
  }));
  if (members.length === 0) return null;

  return {
    recognition_label: asNullableString(version.recognition_label),
    primary_source_url: asNullableString(version.primary_source_url),
    source_checked_at: asNullableString(version.source_checked_at),
    members,
  };
}

/** Tab is shown only when the series current version exists with ≥1 company. */
export function shouldShowPublicPartnerAlumniTab(
  currentVersion: PublicPartnerAlumniCurrentVersion | null,
): boolean {
  return currentVersion !== null && currentVersion.members.length >= 1;
}

function logPublicPartnerAlumniLoadFailure(context: string, error: unknown): void {
  if (process.env.NODE_ENV !== "development") return;
  console.error(`[partner-alumni] public load failed (${context}):`, error);
}

/**
 * Current Partner Alumni for a series — public edition surfaces only.
 * Reads published-only views via the session client (ARC-001 Phase 5).
 * Never reads draft/historical version tables directly.
 *
 * Returns null when data is absent or when the load fails so event pages still render.
 */
export async function getPublicPartnerAlumniForSeriesId(
  seriesId: string,
): Promise<PublicPartnerAlumniCurrentVersion | null> {
  const trimmedSeriesId = seriesId.trim();
  if (trimmedSeriesId === "") return null;

  try {
    const supabase = await createClient();

    const [versionResult, memberRows, destinationIndex] = await Promise.all([
      supabase
        .from("event_partner_alumni_public_versions")
        .select("event_series_id, recognition_label, primary_source_url, source_checked_at")
        .eq("event_series_id", trimmedSeriesId)
        .maybeSingle(),
      fetchAllPaginatedSupabaseRows<PublicPartnerAlumniMemberRow>(async ({ from, to }) => {
        const result = await supabase
          .from("event_partner_alumni_public_members")
          .select(
            [
              "event_series_id",
              "member_id",
              "display_order",
              "company_id",
              "company_name",
              "company_slug",
              "company_domain",
              "company_website",
              "company_logo_url",
              "company_logo_source",
              "company_logo_status",
              "company_restricted_at",
              "company_event_brand_public_profile_approved_at",
            ].join(", "),
          )
          .eq("event_series_id", trimmedSeriesId)
          .order("display_order", { ascending: true })
          .order("member_id", { ascending: true })
          .range(from, to);

        return {
          data: (result.data ?? null) as PublicPartnerAlumniMemberRow[] | null,
          error: result.error,
        };
      }),
      getEventBrandPublicDestinationIndex(),
    ]);

    if (versionResult.error) {
      logPublicPartnerAlumniLoadFailure("version lookup", versionResult.error.message);
      return null;
    }

    return assemblePublicPartnerAlumniCurrentVersion(
      versionResult.data as PublicPartnerAlumniVersionRow | null,
      memberRows,
      (company) => withPublicCompanyRoleHref(company, destinationIndex),
    );
  } catch (error) {
    logPublicPartnerAlumniLoadFailure("unexpected", error);
    return null;
  }
}
