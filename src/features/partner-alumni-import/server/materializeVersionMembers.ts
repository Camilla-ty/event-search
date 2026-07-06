import { createAdminClient } from "@/src/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

import { resolvePartnerAlumniBulkDisplayOrders } from "@/src/features/partner-alumni/lib/partnerAlumniBulkDisplayOrder";

import type { MaterializeVersionMembersChunkResult } from "../types";
import { PartnerAlumniImportHttpError } from "./errors";
import { isUniqueViolation, uniqueViolationUserMessage } from "./errors";

export const MATERIALIZE_VERSION_MEMBERS_DEFAULT_CHUNK = 50;
export const MATERIALIZE_VERSION_MEMBERS_MAX_CHUNK = 100;

export type VersionMemberMaterializeRow = {
  id: string;
  excel_row_number: number;
  resolved_company_id: string | null;
  mapped_display_order: number | null;
  already_on_version_member_id: string | null;
  intended_member_action: string | null;
  version_member_id: string | null;
  match_method: string | null;
};

const VERSION_MEMBER_ROW_SELECT =
  "id, excel_row_number, resolved_company_id, mapped_display_order, already_on_version_member_id, intended_member_action, version_member_id, match_method";

function clampChunkLimit(limit: number | undefined): number {
  const requested = limit ?? MATERIALIZE_VERSION_MEMBERS_DEFAULT_CHUNK;
  return Math.min(Math.max(requested, 1), MATERIALIZE_VERSION_MEMBERS_MAX_CHUNK);
}

async function fetchPendingVersionMemberRows(
  supabase: SupabaseClient,
  batchId: string,
  cursor: number,
  limit: number,
): Promise<VersionMemberMaterializeRow[]> {
  const { data, error } = await supabase
    .from("partner_alumni_import_rows")
    .select(VERSION_MEMBER_ROW_SELECT)
    .eq("batch_id", batchId)
    .eq("status", "resolved")
    .is("version_member_id", null)
    .gt("excel_row_number", cursor)
    .order("excel_row_number", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as VersionMemberMaterializeRow[];
}

async function countVersionMemberMaterializationProgress(
  supabase: SupabaseClient,
  batchId: string,
): Promise<{ total_resolved_rows: number; rows_with_version_member: number }> {
  const { count: totalResolved, error: totalError } = await supabase
    .from("partner_alumni_import_rows")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId)
    .eq("status", "resolved");

  if (totalError) throw new Error(totalError.message);

  const { count: withMember, error: withMemberError } = await supabase
    .from("partner_alumni_import_rows")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId)
    .eq("status", "resolved")
    .not("version_member_id", "is", null);

  if (withMemberError) throw new Error(withMemberError.message);

  return {
    total_resolved_rows: totalResolved ?? 0,
    rows_with_version_member: withMember ?? 0,
  };
}

async function loadVersionDisplayOrders(
  supabase: SupabaseClient,
  versionId: string,
): Promise<number[]> {
  const { data, error } = await supabase
    .from("event_partner_alumni_version_companies")
    .select("display_order")
    .eq("event_partner_alumni_version_id", versionId);

  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((row) => (typeof row.display_order === "number" ? row.display_order : null))
    .filter((order): order is number => order !== null);
}

async function findVersionMemberByCompany(
  supabase: SupabaseClient,
  versionId: string,
  companyId: string,
): Promise<{ id: string; display_order: number } | null> {
  const { data, error } = await supabase
    .from("event_partner_alumni_version_companies")
    .select("id, display_order")
    .eq("event_partner_alumni_version_id", versionId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) return null;
  return {
    id: String(data.id),
    display_order: typeof data.display_order === "number" ? data.display_order : 1,
  };
}

function assignDisplayOrderForRow(
  existingOrders: number[],
  mappedDisplayOrder: number | null,
  excelRowNumber: number,
): { order: number; nextExisting: number[] } {
  const [order] = resolvePartnerAlumniBulkDisplayOrders(existingOrders, [
    { display_order: mappedDisplayOrder, row_number: excelRowNumber },
  ]);
  return { order, nextExisting: [...existingOrders, order] };
}

async function persistRowVersionMemberId(
  supabase: SupabaseClient,
  rowId: string,
  memberId: string,
): Promise<void> {
  const { error } = await supabase
    .from("partner_alumni_import_rows")
    .update({ version_member_id: memberId, updated_at: new Date().toISOString() })
    .eq("id", rowId);

  if (error) throw new Error(error.message);
}

async function upsertVersionMemberForRow(
  supabase: SupabaseClient,
  params: {
    versionId: string;
    row: VersionMemberMaterializeRow;
    existingOrders: number[];
  },
): Promise<{
  memberId: string;
  created: boolean;
  updated: boolean;
  nextExistingOrders: number[];
}> {
  const companyId = params.row.resolved_company_id;
  if (!companyId) {
    throw new PartnerAlumniImportHttpError(
      422,
      `Row ${params.row.excel_row_number} missing resolved company.`,
    );
  }

  const existingMember =
    (params.row.already_on_version_member_id
      ? await supabase
          .from("event_partner_alumni_version_companies")
          .select("id, display_order")
          .eq("id", params.row.already_on_version_member_id)
          .maybeSingle()
          .then(({ data, error }) => {
            if (error) throw new Error(error.message);
            if (!data?.id) return null;
            return {
              id: String(data.id),
              display_order: typeof data.display_order === "number" ? data.display_order : 1,
            };
          })
      : null) ?? (await findVersionMemberByCompany(supabase, params.versionId, companyId));

  const shouldUpdateOrder =
    params.row.intended_member_action === "update_order" ||
    (existingMember !== null &&
      params.row.mapped_display_order !== null &&
      params.row.mapped_display_order !== existingMember.display_order);

  if (existingMember && params.row.intended_member_action === "skip" && !shouldUpdateOrder) {
    return {
      memberId: existingMember.id,
      created: false,
      updated: false,
      nextExistingOrders: params.existingOrders,
    };
  }

  if (existingMember) {
    if (!shouldUpdateOrder) {
      return {
        memberId: existingMember.id,
        created: false,
        updated: false,
        nextExistingOrders: params.existingOrders,
      };
    }

    const { order, nextExisting } = assignDisplayOrderForRow(
      params.existingOrders,
      params.row.mapped_display_order,
      params.row.excel_row_number,
    );

    const { error } = await supabase
      .from("event_partner_alumni_version_companies")
      .update({ display_order: order, updated_at: new Date().toISOString() })
      .eq("id", existingMember.id);

    if (error) throw new Error(error.message);

    return {
      memberId: existingMember.id,
      created: false,
      updated: true,
      nextExistingOrders: nextExisting,
    };
  }

  const { order, nextExisting } = assignDisplayOrderForRow(
    params.existingOrders,
    params.row.mapped_display_order,
    params.row.excel_row_number,
  );

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("event_partner_alumni_version_companies")
    .insert({
      event_partner_alumni_version_id: params.versionId,
      company_id: companyId,
      display_order: order,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (error) {
    const message = error.message;
    if (isUniqueViolation(message)) {
      const raced = await findVersionMemberByCompany(supabase, params.versionId, companyId);
      if (!raced) {
        throw new PartnerAlumniImportHttpError(409, uniqueViolationUserMessage(message), {
          message,
        });
      }
      return {
        memberId: raced.id,
        created: false,
        updated: false,
        nextExistingOrders: params.existingOrders,
      };
    }
    throw new Error(message);
  }

  return {
    memberId: String(data.id),
    created: true,
    updated: false,
    nextExistingOrders: nextExisting,
  };
}

export async function materializeVersionMembersChunk(
  batchId: string,
  versionId: string,
  options: { cursor?: number; limit?: number } = {},
): Promise<MaterializeVersionMembersChunkResult> {
  const supabase = createAdminClient();
  const cursor = options.cursor ?? 0;
  const limit = clampChunkLimit(options.limit);
  const rows = await fetchPendingVersionMemberRows(supabase, batchId, cursor, limit);

  let existingOrders = await loadVersionDisplayOrders(supabase, versionId);
  let examinedCount = 0;
  let skippedCount = 0;
  let membersCreated = 0;
  let membersUpdated = 0;
  let rowsLinked = 0;
  let lastExaminedRowNumber: number | null = null;

  for (const row of rows) {
    examinedCount += 1;
    lastExaminedRowNumber = row.excel_row_number;

    if (row.version_member_id) {
      skippedCount += 1;
      continue;
    }

    if (!row.resolved_company_id) {
      const { error } = await supabase
        .from("partner_alumni_import_rows")
        .update({
          import_error: "Missing resolved company before version member materialization.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (error) throw new Error(error.message);
      skippedCount += 1;
      continue;
    }

    try {
      const upsert = await upsertVersionMemberForRow(supabase, {
        versionId,
        row,
        existingOrders,
      });
      existingOrders = upsert.nextExistingOrders;
      await persistRowVersionMemberId(supabase, row.id, upsert.memberId);

      if (upsert.created) membersCreated += 1;
      if (upsert.updated) membersUpdated += 1;
      rowsLinked += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const { error: markError } = await supabase
        .from("partner_alumni_import_rows")
        .update({ import_error: message, updated_at: new Date().toISOString() })
        .eq("id", row.id);
      if (markError) throw new Error(markError.message);
      throw error;
    }
  }

  const progress = await countVersionMemberMaterializationProgress(supabase, batchId);
  const done = progress.rows_with_version_member >= progress.total_resolved_rows;

  return {
    examined_count: examinedCount,
    skipped_count: skippedCount,
    members_created: membersCreated,
    members_updated: membersUpdated,
    rows_linked: rowsLinked,
    total_resolved_rows: progress.total_resolved_rows,
    rows_with_version_member: progress.rows_with_version_member,
    done,
    next_cursor: done ? null : (lastExaminedRowNumber ?? cursor),
  };
}

export async function isVersionMemberMaterializationComplete(batchId: string): Promise<boolean> {
  const progress = await countVersionMemberMaterializationProgress(createAdminClient(), batchId);
  return progress.rows_with_version_member >= progress.total_resolved_rows;
}
