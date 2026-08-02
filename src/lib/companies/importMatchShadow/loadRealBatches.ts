import type { SupabaseClient } from "@supabase/supabase-js";

import type { ImportMatchShadowRowInput } from "@/src/lib/companies/importMatchShadow/types";
import type { ImportMatchParityImporter } from "@/src/lib/companies/importMatchParity/types";
import type { ShadowLiveOverlays } from "@/src/lib/companies/importMatchShadow/runShadowRow";
import {
  fetchAllPaginatedSupabaseRows,
  SUPABASE_DEFAULT_PAGE_SIZE,
} from "@/src/lib/supabase/fetchAllPaginatedRows";

export type LoadedShadowBatch = {
  importer: ImportMatchParityImporter;
  batch_id: string;
  rows: ImportMatchShadowRowInput[];
  overlays: ShadowLiveOverlays;
};

function mapCommonRow(row: Record<string, unknown>): ImportMatchShadowRowInput {
  return {
    id: String(row.id),
    normalized_domain: (row.normalized_domain as string | null) ?? null,
    normalized_website: (row.normalized_website as string | null) ?? null,
    normalized_company_name: (row.normalized_company_name as string | null) ?? null,
    mapped_tier_rank:
      typeof row.mapped_tier_rank === "number" ? row.mapped_tier_rank : null,
    mapped_display_order:
      typeof row.mapped_display_order === "number" ? row.mapped_display_order : null,
    has_blocking_validation: Boolean(row.has_blocking_validation),
  };
}

/** Read-only: list recent import batches for shadow sampling (no writes). */
export async function listRecentImportBatchesForShadow(
  supabase: SupabaseClient,
  limit = 5,
): Promise<
  Array<{ importer: ImportMatchParityImporter; batch_id: string; context_id: string | null }>
> {
  const out: Array<{
    importer: ImportMatchParityImporter;
    batch_id: string;
    context_id: string | null;
  }> = [];

  const { data: sponsors } = await supabase
    .from("sponsor_import_batches")
    .select("id, event_edition_id")
    .order("created_at", { ascending: false })
    .limit(limit);
  for (const row of sponsors ?? []) {
    out.push({
      importer: "sponsor",
      batch_id: String(row.id),
      context_id: row.event_edition_id ? String(row.event_edition_id) : null,
    });
  }

  const { data: exhibitors } = await supabase
    .from("exhibitor_import_batches")
    .select("id, event_edition_id")
    .order("created_at", { ascending: false })
    .limit(limit);
  for (const row of exhibitors ?? []) {
    out.push({
      importer: "exhibitor",
      batch_id: String(row.id),
      context_id: row.event_edition_id ? String(row.event_edition_id) : null,
    });
  }

  const { data: pa } = await supabase
    .from("partner_alumni_import_batches")
    .select("id, event_partner_alumni_version_id")
    .order("created_at", { ascending: false })
    .limit(limit);
  for (const row of pa ?? []) {
    out.push({
      importer: "partner_alumni",
      batch_id: String(row.id),
      context_id: row.event_partner_alumni_version_id
        ? String(row.event_partner_alumni_version_id)
        : null,
    });
  }

  return out;
}

/**
 * Read-only load of import rows + live overlays for shadow comparison.
 * Never updates batch/row state.
 */
export async function loadImportBatchForShadow(params: {
  supabase: SupabaseClient;
  importer: Exclude<ImportMatchParityImporter, "partner_alumni_bulk">;
  batchId: string;
  contextId: string | null;
}): Promise<LoadedShadowBatch> {
  const { supabase, importer, batchId, contextId } = params;

  if (importer === "sponsor") {
    const { data: rows, error } = await supabase
      .from("sponsor_import_rows")
      .select(
        "id, normalized_domain, normalized_website, normalized_company_name, mapped_tier_rank, has_blocking_validation",
      )
      .eq("batch_id", batchId)
      .order("excel_row_number", { ascending: true });
    if (error) throw new Error(error.message);

    const liveSponsorsByCompanyId = new Map<string, { id: string; tier_rank: number | null }>();
    if (contextId) {
      const { data: live, error: liveError } = await supabase
        .from("event_sponsors")
        .select("id, company_id, tier_rank")
        .eq("event_editions_id", contextId);
      if (liveError) throw new Error(liveError.message);
      for (const link of live ?? []) {
        liveSponsorsByCompanyId.set(String(link.company_id), {
          id: String(link.id),
          tier_rank: typeof link.tier_rank === "number" ? link.tier_rank : null,
        });
      }
    }

    return {
      importer,
      batch_id: batchId,
      rows: (rows ?? []).map((row) => mapCommonRow(row as Record<string, unknown>)),
      overlays: { liveSponsorsByCompanyId },
    };
  }

  if (importer === "exhibitor") {
    const { data: rows, error } = await supabase
      .from("exhibitor_import_rows")
      .select(
        "id, normalized_domain, normalized_website, normalized_company_name, mapped_tier_rank, has_blocking_validation",
      )
      .eq("batch_id", batchId)
      .order("excel_row_number", { ascending: true });
    if (error) throw new Error(error.message);

    const liveExhibitorsByCompanyId = new Map<string, { id: string; tier_rank: number | null }>();
    if (contextId) {
      const { data: live, error: liveError } = await supabase
        .from("event_exhibitors")
        .select("id, company_id, tier_rank")
        .eq("event_editions_id", contextId);
      if (liveError) throw new Error(liveError.message);
      for (const link of live ?? []) {
        liveExhibitorsByCompanyId.set(String(link.company_id), {
          id: String(link.id),
          tier_rank: typeof link.tier_rank === "number" ? link.tier_rank : null,
        });
      }
    }

    return {
      importer,
      batch_id: batchId,
      rows: (rows ?? []).map((row) => mapCommonRow(row as Record<string, unknown>)),
      overlays: { liveExhibitorsByCompanyId },
    };
  }

  // partner_alumni
  const { data: rows, error } = await supabase
    .from("partner_alumni_import_rows")
    .select(
      "id, normalized_domain, normalized_website, normalized_company_name, mapped_display_order, has_blocking_validation",
    )
    .eq("batch_id", batchId)
    .order("excel_row_number", { ascending: true });
  if (error) throw new Error(error.message);

  const versionMembersByCompanyId = new Map<string, { id: string; display_order: number }>();
  if (contextId) {
    const members = await fetchAllPaginatedSupabaseRows<{
      id: unknown;
      company_id: unknown;
      display_order: unknown;
    }>(
      async ({ from, to }) =>
        supabase
          .from("event_partner_alumni_version_companies")
          .select("id, company_id, display_order")
          .eq("event_partner_alumni_version_id", contextId)
          .range(from, to),
      SUPABASE_DEFAULT_PAGE_SIZE,
    );
    for (const member of members) {
      versionMembersByCompanyId.set(String(member.company_id), {
        id: String(member.id),
        display_order: typeof member.display_order === "number" ? member.display_order : 0,
      });
    }
  }

  return {
    importer,
    batch_id: batchId,
    rows: (rows ?? []).map((row) => mapCommonRow(row as Record<string, unknown>)),
    overlays: { versionMembersByCompanyId },
  };
}

/**
 * Derive Partner Alumni bulk shadow rows from an existing PA import batch (read-only).
 * Uses the same identity fields; does not invoke previewPartnerAlumniBulkImport writes.
 */
export async function loadPartnerAlumniBulkShadowRowsFromImportBatch(params: {
  supabase: SupabaseClient;
  batchId: string;
  versionId: string | null;
}): Promise<LoadedShadowBatch> {
  const loaded = await loadImportBatchForShadow({
    supabase: params.supabase,
    importer: "partner_alumni",
    batchId: params.batchId,
    contextId: params.versionId,
  });

  const rosterCompanyIds = new Set(loaded.overlays.versionMembersByCompanyId?.keys() ?? []);

  return {
    importer: "partner_alumni_bulk",
    batch_id: params.batchId,
    rows: loaded.rows.map((row) => ({
      ...row,
      on_roster: false,
      duplicate_in_file: false,
    })),
    overlays: { rosterCompanyIds },
  };
}
