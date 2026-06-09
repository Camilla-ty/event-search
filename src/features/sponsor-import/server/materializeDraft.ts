import { createAdminClient } from "@/src/lib/supabase/admin";
import { slugify } from "@/src/lib/slugify";

import { createCompany } from "@/src/features/companies/server/createCompanyWithLogo";

import type { ImportToDraftResult } from "../types";
import { SponsorImportHttpError } from "./errors";

type ResolvedRow = {
  id: string;
  excel_row_number: number;
  decision_type: string | null;
  resolved_company_id: string | null;
  proposed_company_id: string | null;
  normalized_company_name: string | null;
  normalized_website: string | null;
  proposed_slug: string | null;
  mapped_tier_rank: number | null;
};

async function uniqueSlug(base: string): Promise<string> {
  const supabase = createAdminClient();
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

async function resolveCompanyIdForRow(
  row: ResolvedRow,
  createdByRowId: Map<string, string>,
): Promise<string> {
  const cached = createdByRowId.get(row.id);
  if (cached) return cached;

  if (row.resolved_company_id) {
    return row.resolved_company_id;
  }

  if (row.decision_type === "use_matched" || row.decision_type === "choose_different") {
    const id = row.proposed_company_id;
    if (id) return id;
    throw new SponsorImportHttpError(422, `Row ${row.excel_row_number} missing matched company.`);
  }

  if (row.decision_type === "create_new") {
    const name = row.normalized_company_name?.trim();
    const website = row.normalized_website?.trim();
    if (!name || !website) {
      throw new SponsorImportHttpError(422, `Row ${row.excel_row_number} missing name or website.`);
    }
    const slug = await uniqueSlug(row.proposed_slug ?? name);
    const company = await createCompany({ name, website, slug, city_id: null });
    createdByRowId.set(row.id, company.id);
    return company.id;
  }

  throw new SponsorImportHttpError(422, `Row ${row.excel_row_number} has no company resolution.`);
}

export async function materializeDraftLinks(
  batchId: string,
  eventEditionId: string,
  rows: ResolvedRow[],
): Promise<ImportToDraftResult> {
  const supabase = createAdminClient();
  const createdByRowId = new Map<string, string>();
  let companiesCreated = 0;

  const rowCompanyIds = new Map<string, string>();
  for (const row of rows) {
    const before = createdByRowId.size;
    const companyId = await resolveCompanyIdForRow(row, createdByRowId);
    if (row.decision_type === "create_new" && createdByRowId.size > before) {
      companiesCreated += 1;
    }
    rowCompanyIds.set(row.id, companyId);
  }

  const byCompany = new Map<
    string,
    { tier: number; sourceRowId: string; rowIds: string[] }
  >();

  for (const row of rows) {
    const companyId = rowCompanyIds.get(row.id);
    const tier = row.mapped_tier_rank;
    if (!companyId || tier === null) {
      throw new SponsorImportHttpError(422, `Row ${row.excel_row_number} missing company or tier.`);
    }

    const existing = byCompany.get(companyId);
    if (!existing) {
      byCompany.set(companyId, { tier, sourceRowId: row.id, rowIds: [row.id] });
    } else {
      existing.rowIds.push(row.id);
      if (tier > existing.tier) {
        existing.tier = tier;
        existing.sourceRowId = row.id;
      }
    }
  }

  let draftLinksCreated = 0;
  let draftLinksUpdated = 0;
  let rowsMaterialized = 0;

  for (const [companyId, group] of byCompany) {
    const { data: existingLink, error: findError } = await supabase
      .from("sponsor_import_draft_links")
      .select("id")
      .eq("batch_id", batchId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (findError) throw new Error(findError.message);

    let linkId: string;
    if (existingLink) {
      const { data: updated, error: updateError } = await supabase
        .from("sponsor_import_draft_links")
        .update({
          tier_rank: group.tier,
          source_import_row_id: group.sourceRowId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingLink.id)
        .select("id")
        .single();
      if (updateError) throw new Error(updateError.message);
      linkId = String(updated.id);
      draftLinksUpdated += 1;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("sponsor_import_draft_links")
        .insert({
          batch_id: batchId,
          event_edition_id: eventEditionId,
          company_id: companyId,
          tier_rank: group.tier,
          source_import_row_id: group.sourceRowId,
          excluded_from_publish: false,
        })
        .select("id")
        .single();
      if (insertError) throw new Error(insertError.message);
      linkId = String(inserted.id);
      draftLinksCreated += 1;
    }

    for (const rowId of group.rowIds) {
      const { error: rowError } = await supabase
        .from("sponsor_import_rows")
        .update({ draft_link_id: linkId, updated_at: new Date().toISOString() })
        .eq("id", rowId);
      if (rowError) throw new Error(rowError.message);
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
