import { createAdminClient } from "@/src/lib/supabase/admin";

import type { ImportToDraftResult } from "../types";
import { isUniqueViolation, SponsorImportHttpError } from "./errors";
import {
  resolveCompanyIdForRow,
  type MaterializeCompanyRow,
} from "./materializeCompanies";

type ResolvedRow = MaterializeCompanyRow & {
  mapped_tier_rank: number | null;
  mapped_tier_label: string | null;
  draft_link_id: string | null;
};

export async function materializeDraftLinks(
  batchId: string,
  eventEditionId: string,
  rows: ResolvedRow[],
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

  const byCompany = new Map<
    string,
    { tier: number; tierLabel: string | null; sourceRowId: string; rowIds: string[] }
  >();

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
          tier_label: group.tierLabel,
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
          tier_label: group.tierLabel,
          source_import_row_id: group.sourceRowId,
          excluded_from_publish: false,
        })
        .select("id")
        .single();

      if (insertError) {
        const insertMessage = insertError.message;
        if (isUniqueViolation(insertMessage)) {
          const { data: racedLink, error: racedFindError } = await supabase
            .from("sponsor_import_draft_links")
            .select("id")
            .eq("batch_id", batchId)
            .eq("company_id", companyId)
            .maybeSingle();
          if (racedFindError) throw new Error(racedFindError.message);
          if (!racedLink) throw new Error(insertMessage);

          const { data: updated, error: updateError } = await supabase
            .from("sponsor_import_draft_links")
            .update({
              tier_rank: group.tier,
              tier_label: group.tierLabel,
              source_import_row_id: group.sourceRowId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", racedLink.id)
            .select("id")
            .single();
          if (updateError) throw new Error(updateError.message);
          linkId = String(updated.id);
          draftLinksUpdated += 1;
        } else {
          throw new Error(insertMessage);
        }
      } else {
        linkId = String(inserted.id);
        draftLinksCreated += 1;
      }
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
