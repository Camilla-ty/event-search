import { createAdminClient } from "@/src/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { ImportToDraftResult, MaterializeDraftLinksChunkResult } from "../types";
import { isUniqueViolation, SponsorImportHttpError } from "./errors";
import {
  resolveCompanyIdForRow,
  type MaterializeCompanyRow,
} from "./materializeCompanies";

export const MATERIALIZE_DRAFT_LINKS_DEFAULT_CHUNK = 50;
export const MATERIALIZE_DRAFT_LINKS_MAX_CHUNK = 100;

export type DraftLinkMaterializeRow = MaterializeCompanyRow & {
  mapped_tier_rank: number | null;
  mapped_tier_label: string | null;
  draft_link_id: string | null;
};

type CompanyDraftLinkGroup = {
  tier: number;
  tierLabel: string | null;
  sourceRowId: string;
  rowIds: string[];
};

export type UpsertDraftLinkForRowResult = {
  linkId: string;
  linkCreated: boolean;
  linkUpdated: boolean;
};

const DRAFT_LINK_MATERIALIZE_ROW_SELECT =
  "id, excel_row_number, decision_type, resolved_company_id, proposed_company_id, normalized_company_name, normalized_website, proposed_slug, mapped_tier_rank, mapped_tier_label, draft_link_id";

function clampChunkLimit(limit: number | undefined): number {
  const requested = limit ?? MATERIALIZE_DRAFT_LINKS_DEFAULT_CHUNK;
  return Math.min(Math.max(requested, 1), MATERIALIZE_DRAFT_LINKS_MAX_CHUNK);
}

function requireRowCompanyAndTier(row: DraftLinkMaterializeRow): {
  companyId: string;
  tier: number;
} {
  const companyId = row.resolved_company_id;
  const tier = row.mapped_tier_rank;
  if (!companyId || tier === null) {
    throw new SponsorImportHttpError(
      422,
      `Row ${row.excel_row_number} missing company or tier.`,
    );
  }
  return { companyId, tier };
}

async function findDraftLink(
  supabase: SupabaseClient,
  batchId: string,
  companyId: string,
): Promise<{ id: string; tier_rank: number } | null> {
  const { data, error } = await supabase
    .from("sponsor_import_draft_links")
    .select("id, tier_rank")
    .eq("batch_id", batchId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) return null;
  return { id: String(data.id), tier_rank: Number(data.tier_rank) };
}

async function updateDraftLink(
  supabase: SupabaseClient,
  linkId: string,
  params: {
    tier: number;
    tierLabel: string | null;
    sourceRowId: string;
  },
): Promise<string> {
  const { data, error } = await supabase
    .from("sponsor_import_draft_links")
    .update({
      tier_rank: params.tier,
      tier_label: params.tierLabel,
      source_import_row_id: params.sourceRowId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", linkId)
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return String(data.id);
}

async function insertDraftLink(
  supabase: SupabaseClient,
  params: {
    batchId: string;
    eventEditionId: string;
    companyId: string;
    tier: number;
    tierLabel: string | null;
    sourceRowId: string;
  },
): Promise<string> {
  const { data, error } = await supabase
    .from("sponsor_import_draft_links")
    .insert({
      batch_id: params.batchId,
      event_edition_id: params.eventEditionId,
      company_id: params.companyId,
      tier_rank: params.tier,
      tier_label: params.tierLabel,
      source_import_row_id: params.sourceRowId,
      excluded_from_publish: false,
    })
    .select("id")
    .single();

  if (error) {
    const insertMessage = error.message;
    if (!isUniqueViolation(insertMessage)) {
      throw new Error(insertMessage);
    }

    const racedLink = await findDraftLink(supabase, params.batchId, params.companyId);
    if (!racedLink) throw new Error(insertMessage);

    return updateDraftLink(supabase, racedLink.id, {
      tier: params.tier,
      tierLabel: params.tierLabel,
      sourceRowId: params.sourceRowId,
    });
  }

  return String(data.id);
}

/** Incremental upsert for chunked draft-link materialization (max tier wins). */
export async function upsertDraftLinkForRow(
  supabase: SupabaseClient,
  params: {
    batchId: string;
    eventEditionId: string;
    row: DraftLinkMaterializeRow;
    companyId: string;
    tier: number;
  },
): Promise<UpsertDraftLinkForRowResult> {
  const existingLink = await findDraftLink(supabase, params.batchId, params.companyId);

  if (!existingLink) {
    const linkId = await insertDraftLink(supabase, {
      batchId: params.batchId,
      eventEditionId: params.eventEditionId,
      companyId: params.companyId,
      tier: params.tier,
      tierLabel: params.row.mapped_tier_label,
      sourceRowId: params.row.id,
    });
    return { linkId, linkCreated: true, linkUpdated: false };
  }

  if (params.tier > existingLink.tier_rank) {
    const linkId = await updateDraftLink(supabase, existingLink.id, {
      tier: params.tier,
      tierLabel: params.row.mapped_tier_label,
      sourceRowId: params.row.id,
    });
    return { linkId, linkCreated: false, linkUpdated: true };
  }

  return { linkId: existingLink.id, linkCreated: false, linkUpdated: false };
}

async function upsertDraftLinkForCompanyGroup(
  supabase: SupabaseClient,
  batchId: string,
  eventEditionId: string,
  companyId: string,
  group: CompanyDraftLinkGroup,
): Promise<{ linkId: string; linkCreated: boolean; linkUpdated: boolean }> {
  const existingLink = await findDraftLink(supabase, batchId, companyId);

  if (existingLink) {
    const linkId = await updateDraftLink(supabase, existingLink.id, {
      tier: group.tier,
      tierLabel: group.tierLabel,
      sourceRowId: group.sourceRowId,
    });
    return { linkId, linkCreated: false, linkUpdated: true };
  }

  const linkId = await insertDraftLink(supabase, {
    batchId,
    eventEditionId,
    companyId,
    tier: group.tier,
    tierLabel: group.tierLabel,
    sourceRowId: group.sourceRowId,
  });
  return { linkId, linkCreated: true, linkUpdated: false };
}

export type MaterializeDraftLinksChunkDeps = {
  fetchPendingRows: (
    batchId: string,
    cursor: number,
    limit: number,
  ) => Promise<DraftLinkMaterializeRow[]>;
  countProgress: (
    batchId: string,
  ) => Promise<{ total_resolved_rows: number; rows_with_draft_link: number }>;
  persistRowDraftLinkId: (rowId: string, linkId: string) => Promise<void>;
  upsertDraftLinkForRow: (params: {
    batchId: string;
    eventEditionId: string;
    row: DraftLinkMaterializeRow;
    companyId: string;
    tier: number;
  }) => Promise<UpsertDraftLinkForRowResult>;
};

async function fetchPendingDraftLinkRows(
  supabase: SupabaseClient,
  batchId: string,
  cursor: number,
  limit: number,
): Promise<DraftLinkMaterializeRow[]> {
  const { data, error } = await supabase
    .from("sponsor_import_rows")
    .select(DRAFT_LINK_MATERIALIZE_ROW_SELECT)
    .eq("batch_id", batchId)
    .eq("status", "resolved")
    .is("draft_link_id", null)
    .gt("excel_row_number", cursor)
    .order("excel_row_number", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as DraftLinkMaterializeRow[];
}

async function countDraftLinkMaterializationProgress(
  supabase: SupabaseClient,
  batchId: string,
): Promise<{ total_resolved_rows: number; rows_with_draft_link: number }> {
  const { count: totalResolved, error: totalError } = await supabase
    .from("sponsor_import_rows")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId)
    .eq("status", "resolved");

  if (totalError) throw new Error(totalError.message);

  const { count: withDraftLink, error: withDraftLinkError } = await supabase
    .from("sponsor_import_rows")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId)
    .eq("status", "resolved")
    .not("draft_link_id", "is", null);

  if (withDraftLinkError) throw new Error(withDraftLinkError.message);

  return {
    total_resolved_rows: totalResolved ?? 0,
    rows_with_draft_link: withDraftLink ?? 0,
  };
}

async function persistRowDraftLinkId(
  supabase: SupabaseClient,
  rowId: string,
  linkId: string,
): Promise<void> {
  const { error } = await supabase
    .from("sponsor_import_rows")
    .update({ draft_link_id: linkId, updated_at: new Date().toISOString() })
    .eq("id", rowId);

  if (error) throw new Error(error.message);
}

export async function materializeDraftLinksChunkWithDeps(
  batchId: string,
  eventEditionId: string,
  options: { cursor?: number; limit?: number },
  deps: MaterializeDraftLinksChunkDeps,
): Promise<MaterializeDraftLinksChunkResult> {
  const cursor = options.cursor ?? 0;
  const limit = clampChunkLimit(options.limit);
  const rows = await deps.fetchPendingRows(batchId, cursor, limit);

  let examinedCount = 0;
  let skippedCount = 0;
  let linksCreated = 0;
  let linksUpdated = 0;
  let rowsLinked = 0;
  let lastExaminedRowNumber: number | null = null;

  for (const row of rows) {
    examinedCount += 1;
    lastExaminedRowNumber = row.excel_row_number;

    if (row.draft_link_id) {
      skippedCount += 1;
      continue;
    }

    const { companyId, tier } = requireRowCompanyAndTier(row);
    const upsert = await deps.upsertDraftLinkForRow({
      batchId,
      eventEditionId,
      row,
      companyId,
      tier,
    });
    await deps.persistRowDraftLinkId(row.id, upsert.linkId);

    if (upsert.linkCreated) linksCreated += 1;
    if (upsert.linkUpdated) linksUpdated += 1;
    rowsLinked += 1;
  }

  const progress = await deps.countProgress(batchId);
  const done = progress.rows_with_draft_link >= progress.total_resolved_rows;

  return {
    examined_count: examinedCount,
    skipped_count: skippedCount,
    links_created: linksCreated,
    links_updated: linksUpdated,
    rows_linked: rowsLinked,
    total_resolved_rows: progress.total_resolved_rows,
    rows_with_draft_link: progress.rows_with_draft_link,
    done,
    next_cursor: done ? null : (lastExaminedRowNumber ?? cursor),
  };
}

export async function materializeDraftLinksChunk(
  batchId: string,
  eventEditionId: string,
  options: { cursor?: number; limit?: number } = {},
): Promise<MaterializeDraftLinksChunkResult> {
  const supabase = createAdminClient();

  return materializeDraftLinksChunkWithDeps(batchId, eventEditionId, options, {
    fetchPendingRows: (id, cursor, limit) =>
      fetchPendingDraftLinkRows(supabase, id, cursor, limit),
    countProgress: (id) => countDraftLinkMaterializationProgress(supabase, id),
    persistRowDraftLinkId: (rowId, linkId) =>
      persistRowDraftLinkId(supabase, rowId, linkId),
    upsertDraftLinkForRow: (params) =>
      upsertDraftLinkForRow(supabase, params),
  });
}

export async function materializeDraftLinks(
  batchId: string,
  eventEditionId: string,
  rows: DraftLinkMaterializeRow[],
): Promise<ImportToDraftResult> {
  const supabase = createAdminClient();
  const createdByRowId = new Map<string, string>();
  const createNewByNameKey = new Map<string, string>();
  let companiesCreated = 0;

  const rowCompanyIds = new Map<string, string>();
  for (const row of rows) {
    const { companyId, created } = await resolveCompanyIdForRow(
      supabase,
      row,
      createdByRowId,
      createNewByNameKey,
    );
    if (row.decision_type === "create_new" && created) {
      companiesCreated += 1;
    }
    rowCompanyIds.set(row.id, companyId);
  }

  const byCompany = new Map<string, CompanyDraftLinkGroup>();

  for (const row of rows) {
    const companyId = rowCompanyIds.get(row.id);
    const tier = row.mapped_tier_rank;
    if (!companyId || tier === null) {
      throw new SponsorImportHttpError(422, `Row ${row.excel_row_number} missing company or tier.`);
    }

    const existing = byCompany.get(companyId);
    if (!existing) {
      byCompany.set(companyId, {
        tier,
        tierLabel: row.mapped_tier_label,
        sourceRowId: row.id,
        rowIds: [row.id],
      });
    } else {
      existing.rowIds.push(row.id);
      if (tier > existing.tier) {
        existing.tier = tier;
        existing.tierLabel = row.mapped_tier_label;
        existing.sourceRowId = row.id;
      }
    }
  }

  let draftLinksCreated = 0;
  let draftLinksUpdated = 0;
  let rowsMaterialized = 0;

  for (const [companyId, group] of byCompany) {
    const upsert = await upsertDraftLinkForCompanyGroup(
      supabase,
      batchId,
      eventEditionId,
      companyId,
      group,
    );

    if (upsert.linkCreated) draftLinksCreated += 1;
    if (upsert.linkUpdated) draftLinksUpdated += 1;

    for (const rowId of group.rowIds) {
      await persistRowDraftLinkId(supabase, rowId, upsert.linkId);
      rowsMaterialized += 1;
    }
  }

  return {
    companies_created: companiesCreated,
    draft_links_created: draftLinksCreated,
    draft_links_updated: draftLinksUpdated,
    rows_materialized: rowsMaterialized,
  };
}
