import { createAdminClient } from "@/src/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createCompanyResolutionCaches,
  materializeCompaniesChunkWithDeps,
  resolveCompanyIdForRow,
  type MaterializeCompanyRow,
} from "@/src/features/sponsor-import/server/materializeCompanies";
import { SponsorImportHttpError } from "@/src/features/sponsor-import/server/errors";

import type { MaterializeCompaniesChunkResult } from "../types";
import { PartnerAlumniImportHttpError } from "./errors";

export {
  MATERIALIZE_COMPANIES_DEFAULT_CHUNK,
  MATERIALIZE_COMPANIES_MAX_CHUNK,
} from "@/src/features/sponsor-import/server/materializeCompanies";

const MATERIALIZE_COMPANY_ROW_SELECT =
  "id, excel_row_number, decision_type, resolved_company_id, proposed_company_id, normalized_company_name, normalized_website, proposed_slug";

async function fetchPendingCompanyRows(
  supabase: SupabaseClient,
  batchId: string,
  cursor: number,
  limit: number,
): Promise<MaterializeCompanyRow[]> {
  const { data, error } = await supabase
    .from("partner_alumni_import_rows")
    .select(MATERIALIZE_COMPANY_ROW_SELECT)
    .eq("batch_id", batchId)
    .eq("status", "resolved")
    .is("resolved_company_id", null)
    .gt("excel_row_number", cursor)
    .order("excel_row_number", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as MaterializeCompanyRow[];
}

async function countCompanyMaterializationProgress(
  supabase: SupabaseClient,
  batchId: string,
): Promise<{ total_resolved_rows: number; rows_with_company_id: number }> {
  const { count: totalResolved, error: totalError } = await supabase
    .from("partner_alumni_import_rows")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId)
    .eq("status", "resolved");

  if (totalError) throw new Error(totalError.message);

  const { count: withCompanyId, error: withCompanyError } = await supabase
    .from("partner_alumni_import_rows")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId)
    .eq("status", "resolved")
    .not("resolved_company_id", "is", null);

  if (withCompanyError) throw new Error(withCompanyError.message);

  return {
    total_resolved_rows: totalResolved ?? 0,
    rows_with_company_id: withCompanyId ?? 0,
  };
}

async function persistResolvedCompanyId(
  supabase: SupabaseClient,
  rowId: string,
  companyId: string,
): Promise<void> {
  const { error } = await supabase
    .from("partner_alumni_import_rows")
    .update({ resolved_company_id: companyId, updated_at: new Date().toISOString() })
    .eq("id", rowId);

  if (error) throw new Error(error.message);
}

function wrapSponsorMaterializeError(error: unknown): never {
  if (error instanceof SponsorImportHttpError) {
    throw new PartnerAlumniImportHttpError(error.status, error.message, error.details);
  }
  throw error instanceof Error ? error : new Error(String(error));
}

export async function materializePartnerAlumniCompaniesChunk(
  batchId: string,
  options: { cursor?: number; limit?: number } = {},
): Promise<MaterializeCompaniesChunkResult> {
  const supabase = createAdminClient();

  return materializeCompaniesChunkWithDeps(batchId, options, {
    fetchPendingRows: (id, cursor, limit) =>
      fetchPendingCompanyRows(supabase, id, cursor, limit),
    countProgress: (id) => countCompanyMaterializationProgress(supabase, id),
    persistRowCompanyId: (rowId, companyId) =>
      persistResolvedCompanyId(supabase, rowId, companyId),
    resolveCompanyIdForRow: async (row, caches) => {
      if (row.decision_type !== "create_new" && row.resolved_company_id) {
        return { companyId: row.resolved_company_id, created: false };
      }
      if (row.decision_type === "create_new" && !row.resolved_company_id) {
        try {
          return await resolveCompanyIdForRow(
            supabase,
            row,
            caches.createdByRowId,
            caches.createNewByNameKey,
          );
        } catch (error) {
          wrapSponsorMaterializeError(error);
        }
      }
      try {
        return await resolveCompanyIdForRow(
          supabase,
          row,
          caches.createdByRowId,
          caches.createNewByNameKey,
        );
      } catch (error) {
        wrapSponsorMaterializeError(error);
      }
    },
  });
}

export async function isPartnerAlumniCompanyMaterializationComplete(
  batchId: string,
): Promise<boolean> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("partner_alumni_import_rows")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId)
    .eq("status", "resolved")
    .is("resolved_company_id", null);

  if (error) throw new Error(error.message);
  return (count ?? 0) === 0;
}

export async function assertCreateNewRowsExplicit(
  supabase: SupabaseClient,
  batchId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("partner_alumni_import_rows")
    .select("id, excel_row_number")
    .eq("batch_id", batchId)
    .eq("status", "resolved")
    .eq("decision_type", "create_new")
    .is("decision_by", null);

  if (error) throw new Error(error.message);
  if ((data ?? []).length > 0) {
    throw new PartnerAlumniImportHttpError(
      422,
      "Create-new rows must be explicitly approved before materialization.",
      { row_ids: (data ?? []).map((row) => row.id) },
    );
  }
}

export async function countPendingCreateNewRowsDetailed(
  supabase: SupabaseClient,
  batchId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("partner_alumni_import_rows")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId)
    .eq("status", "resolved")
    .eq("decision_type", "create_new");

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export { createCompanyResolutionCaches };
