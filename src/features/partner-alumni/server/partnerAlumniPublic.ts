import type { EventSponsorCompany } from "@/src/features/events/components/detail/types";
import { mapPublicLogoUrl } from "@/src/lib/storage/mapPublicLogoUrl";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { fetchAllPaginatedSupabaseRows } from "@/src/lib/supabase/fetchAllPaginatedRows";

const COMPANY_PUBLIC_SELECT = "id, slug, name, logo_url, logo_source, logo_status";

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

function mapVersionMemberCompany(raw: unknown): EventSponsorCompany | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const row = raw as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id : row.id != null ? String(row.id) : null;
  if (!id) return null;

  return {
    id,
    slug: typeof row.slug === "string" ? row.slug : null,
    name: typeof row.name === "string" ? row.name : null,
    logo_url: mapPublicLogoUrl(typeof row.logo_url === "string" ? row.logo_url : null),
    logo_source: typeof row.logo_source === "string" ? row.logo_source : null,
    logo_status: typeof row.logo_status === "string" ? row.logo_status : null,
  };
}

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

    members.push({
      id,
      display_order: displayOrder,
      company: mapVersionMemberCompany(record.companies),
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

/** Tab is shown only when the series current version exists with ≥1 company. */
export function shouldShowPublicPartnerAlumniTab(
  currentVersion: PublicPartnerAlumniCurrentVersion | null,
): boolean {
  return currentVersion !== null && currentVersion.members.length >= 1;
}

type VersionMemberRow = {
  id: unknown;
  display_order: unknown;
  company_id: unknown;
  companies: unknown;
};

function logPublicPartnerAlumniLoadFailure(context: string, error: unknown): void {
  if (process.env.NODE_ENV !== "development") return;
  console.error(`[partner-alumni] public load failed (${context}):`, error);
}

/**
 * Current Partner Alumni for a series — public edition surfaces only.
 * Resolves event_partner_alumni.current_version_id → version header → version members
 * via service role (v2 tables are not publicly readable). Never reads draft/v1 tables.
 *
 * Returns null when data is absent or when the load fails so event pages still render.
 */
export async function getPublicPartnerAlumniForSeriesId(
  seriesId: string,
): Promise<PublicPartnerAlumniCurrentVersion | null> {
  const trimmedSeriesId = seriesId.trim();
  if (trimmedSeriesId === "") return null;

  try {
    const admin = createAdminClient();
    const { data: program, error: programError } = await admin
      .from("event_partner_alumni")
      .select("current_version_id")
      .eq("event_series_id", trimmedSeriesId)
      .maybeSingle();

    if (programError) {
      logPublicPartnerAlumniLoadFailure("program lookup", programError.message);
      return null;
    }

    const versionId =
      program && typeof program.current_version_id === "string"
        ? program.current_version_id.trim()
        : "";
    if (versionId === "") return null;

    const [versionResult, memberRows] = await Promise.all([
      admin
        .from("event_partner_alumni_versions")
        .select("id, recognition_label, primary_source_url, source_checked_at")
        .eq("id", versionId)
        .maybeSingle(),
      fetchAllPaginatedSupabaseRows<VersionMemberRow>(async ({ from, to }) =>
        admin
          .from("event_partner_alumni_version_companies")
          .select(`id, display_order, company_id, companies ( ${COMPANY_PUBLIC_SELECT} )`)
          .eq("event_partner_alumni_version_id", versionId)
          .order("display_order", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to),
      ),
    ]);

    if (versionResult.error) {
      logPublicPartnerAlumniLoadFailure("version lookup", versionResult.error.message);
      return null;
    }
    if (!versionResult.data) return null;

    const versionRow = versionResult.data as Record<string, unknown>;
    const members = mapPublicPartnerAlumniMembers(memberRows);
    if (members.length === 0) return null;

    return {
      recognition_label:
        typeof versionRow.recognition_label === "string"
          ? versionRow.recognition_label
          : null,
      primary_source_url:
        typeof versionRow.primary_source_url === "string"
          ? versionRow.primary_source_url
          : null,
      source_checked_at:
        typeof versionRow.source_checked_at === "string"
          ? versionRow.source_checked_at
          : null,
      members,
    };
  } catch (error) {
    logPublicPartnerAlumniLoadFailure("unexpected", error);
    return null;
  }
}

