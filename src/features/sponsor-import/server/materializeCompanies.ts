import {
  createCompany,
  enrichCompanyLogo,
} from "@/src/features/companies/server/createCompanyWithLogo";
import {
  duplicateNameReviewMessage,
  duplicateNameReviewPatch,
  isCompanyCreateNeedsReview,
  isExplicitDuplicateNameCreate,
  lookupCompanyNameAndDomain,
  resolveCompanyCreate,
  type CompanyCreateResolution,
} from "@/src/lib/companies/duplicateCompanyName";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { slugify } from "@/src/lib/slugify";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { MaterializeCompaniesChunkResult } from "../types";
import { SponsorImportHttpError } from "./errors";

export const MATERIALIZE_COMPANIES_DEFAULT_CHUNK = 15;
export const MATERIALIZE_COMPANIES_MAX_CHUNK = 20;

export type MaterializeCompanyRow = {
  id: string;
  excel_row_number: number;
  decision_type: string | null;
  resolved_company_id: string | null;
  proposed_company_id: string | null;
  normalized_company_name: string | null;
  normalized_website: string | null;
  proposed_slug: string | null;
  draft_link_id?: string | null;
  decision_source?: string | null;
  conflict_type?: string | null;
};

export type CompanyResolutionCaches = {
  createdByRowId: Map<string, string>;
  createNewByNameKey: Map<string, string>;
};

export function createCompanyResolutionCaches(): CompanyResolutionCaches {
  return {
    createdByRowId: new Map(),
    createNewByNameKey: new Map(),
  };
}

export async function uniqueSlug(
  base: string,
  supabase: SupabaseClient = createAdminClient(),
): Promise<string> {
  let candidate = slugify(base);
  if (!candidate) candidate = "company";

  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? candidate : `${candidate}-${i + 1}`;
    const { data, error } = await supabase
      .from("companies")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return slug;
  }

  throw new Error("Could not allocate unique company slug.");
}

export async function findExistingCompanyId(
  supabase: SupabaseClient,
  name: string,
  website: string | null,
): Promise<string | null> {
  const found = await lookupCompanyNameAndDomain(supabase, name, website);
  if (found.domain && found.sameDomainCompanyId) return found.sameDomainCompanyId;
  return null;
}

export async function resolveCreateNewCompanyId(
  supabase: SupabaseClient,
  row: MaterializeCompanyRow,
  createNewByNameKey: Map<string, string>,
): Promise<CompanyCreateResolution> {
  const name = row.normalized_company_name?.trim();
  if (!name) {
    throw new SponsorImportHttpError(422, `Row ${row.excel_row_number} missing company name.`);
  }

  const websiteRaw = row.normalized_website?.trim() ?? "";
  const website = websiteRaw !== "" ? websiteRaw : null;

  try {
    return await resolveCompanyCreate({
      supabase,
      name,
      website,
      explicitCreate: isExplicitDuplicateNameCreate(row),
      cache: createNewByNameKey,
      create: async () => {
        const slug = await uniqueSlug(row.proposed_slug ?? name, supabase);
        const company = await createCompany({ name, website, slug, city_id: null });
        if (website) {
          void enrichCompanyLogo(company.id, website);
        }
        return { id: company.id };
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new SponsorImportHttpError(
      409,
      `Could not create company "${name}" for row ${row.excel_row_number}: ${message}`,
    );
  }
}

export async function resolveCompanyIdForRow(
  supabase: SupabaseClient,
  row: MaterializeCompanyRow,
  createdByRowId: Map<string, string>,
  createNewByNameKey: Map<string, string>,
): Promise<CompanyCreateResolution> {
  const cached = createdByRowId.get(row.id);
  if (cached) return { companyId: cached, created: false };

  if (row.draft_link_id) {
    const { data: link, error: linkError } = await supabase
      .from("sponsor_import_draft_links")
      .select("company_id")
      .eq("id", row.draft_link_id)
      .maybeSingle();
    if (linkError) throw new Error(linkError.message);
    if (link?.company_id) {
      const companyId = String(link.company_id);
      createdByRowId.set(row.id, companyId);
      return { companyId, created: false };
    }
  }

  if (row.resolved_company_id) {
    const companyId = row.resolved_company_id;
    createdByRowId.set(row.id, companyId);
    return { companyId, created: false };
  }

  if (row.decision_type === "use_matched" || row.decision_type === "choose_different") {
    const id = row.proposed_company_id;
    if (!id) {
      throw new SponsorImportHttpError(422, `Row ${row.excel_row_number} missing matched company.`);
    }
    createdByRowId.set(row.id, id);
    return { companyId: id, created: false };
  }

  if (row.decision_type === "create_new") {
    const result = await resolveCreateNewCompanyId(supabase, row, createNewByNameKey);
    if (!isCompanyCreateNeedsReview(result)) {
      createdByRowId.set(row.id, result.companyId);
    }
    return result;
  }

  throw new SponsorImportHttpError(422, `Row ${row.excel_row_number} has no company resolution.`);
}

const MATERIALIZE_COMPANY_ROW_SELECT =
  "id, excel_row_number, decision_type, decision_source, conflict_type, resolved_company_id, proposed_company_id, normalized_company_name, normalized_website, proposed_slug, draft_link_id";

export type MaterializeCompaniesChunkDeps = {
  fetchPendingRows: (
    batchId: string,
    cursor: number,
    limit: number,
  ) => Promise<MaterializeCompanyRow[]>;
  countProgress: (
    batchId: string,
  ) => Promise<{ total_resolved_rows: number; rows_with_company_id: number }>;
  /**
   * Only while the row is still `resolved` with no company: false if a Review decision changed
   * it after it was read, in which case nothing is written. Callers that write unconditionally
   * return nothing.
   */
  persistRowCompanyId: (rowId: string, companyId: string) => Promise<boolean | void>;
  resolveCompanyIdForRow?: (
    row: MaterializeCompanyRow,
    caches: CompanyResolutionCaches,
  ) => Promise<CompanyCreateResolution>;
  deferDuplicateNameRow?: (
    rowId: string,
    resolution: Extract<CompanyCreateResolution, { needsReview: true }>,
  ) => Promise<void>;
};

async function fetchPendingCompanyRows(
  supabase: SupabaseClient,
  batchId: string,
  cursor: number,
  limit: number,
): Promise<MaterializeCompanyRow[]> {
  const { data, error } = await supabase
    .from("sponsor_import_rows")
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
    .from("sponsor_import_rows")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId)
    .eq("status", "resolved");

  if (totalError) throw new Error(totalError.message);

  const { count: withCompanyId, error: withCompanyError } = await supabase
    .from("sponsor_import_rows")
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
): Promise<boolean> {
  const { data, error } = await supabase
    .from("sponsor_import_rows")
    .update({
      resolved_company_id: companyId,
      import_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", rowId)
    .eq("status", "resolved")
    .is("resolved_company_id", null)
    .select("id");

  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

function clampChunkLimit(limit: number | undefined): number {
  const requested = limit ?? MATERIALIZE_COMPANIES_DEFAULT_CHUNK;
  return Math.min(Math.max(requested, 1), MATERIALIZE_COMPANIES_MAX_CHUNK);
}

export async function materializeCompaniesChunkWithDeps(
  batchId: string,
  options: { cursor?: number; limit?: number },
  deps: MaterializeCompaniesChunkDeps,
): Promise<MaterializeCompaniesChunkResult> {
  const cursor = options.cursor ?? 0;
  const limit = clampChunkLimit(options.limit);

  const supabase = deps.resolveCompanyIdForRow ? null : createAdminClient();
  const resolveRow =
    deps.resolveCompanyIdForRow ??
    ((row, caches) =>
      resolveCompanyIdForRow(
        supabase!,
        row,
        caches.createdByRowId,
        caches.createNewByNameKey,
      ));

  const rows = await deps.fetchPendingRows(batchId, cursor, limit);
  const caches = createCompanyResolutionCaches();

  let examinedCount = 0;
  let skippedCount = 0;
  let materializedCount = 0;
  let companiesCreated = 0;
  let conflictCount = 0;
  let duplicateNameReviewCount = 0;
  let lastExaminedRowNumber: number | null = null;

  for (const row of rows) {
    examinedCount += 1;
    lastExaminedRowNumber = row.excel_row_number;

    if (row.resolved_company_id) {
      skippedCount += 1;
      caches.createdByRowId.set(row.id, row.resolved_company_id);
      continue;
    }

    const resolved = await resolveRow(row, caches);
    if (isCompanyCreateNeedsReview(resolved)) {
      if (!deps.deferDuplicateNameRow) {
        throw new SponsorImportHttpError(409, duplicateNameReviewMessage(resolved.reason));
      }
      await deps.deferDuplicateNameRow(row.id, resolved);
      conflictCount += 1;
      duplicateNameReviewCount += 1;
      continue;
    }
    const { companyId, created } = resolved;
    if ((await deps.persistRowCompanyId(row.id, companyId)) === false) {
      // The reviewer's later decision stands; a company created for it is kept unused.
      conflictCount += 1;
      continue;
    }
    materializedCount += 1;
    if (row.decision_type === "create_new" && created) {
      companiesCreated += 1;
    }
  }

  const progress = await deps.countProgress(batchId);
  const done = progress.rows_with_company_id >= progress.total_resolved_rows;

  return {
    examined_count: examinedCount,
    skipped_count: skippedCount,
    materialized_count: materializedCount,
    companies_created: companiesCreated,
    total_resolved_rows: progress.total_resolved_rows,
    rows_with_company_id: progress.rows_with_company_id,
    conflict_count: conflictCount,
    duplicate_name_review_count: duplicateNameReviewCount,
    done,
    next_cursor: done ? null : (lastExaminedRowNumber ?? cursor),
    claim_token: null,
  };
}

export async function materializeCompaniesChunk(
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
    deferDuplicateNameRow: (rowId, resolution) =>
      deferDuplicateNameRow(supabase, rowId, resolution),
  });
}

async function deferDuplicateNameRow(
  supabase: SupabaseClient,
  rowId: string,
  resolution: Extract<CompanyCreateResolution, { needsReview: true }>,
): Promise<void> {
  const { error } = await supabase
    .from("sponsor_import_rows")
    .update(duplicateNameReviewPatch(resolution))
    .eq("id", rowId)
    .eq("status", "resolved")
    .is("resolved_company_id", null);
  if (error) throw new Error(error.message);
}
