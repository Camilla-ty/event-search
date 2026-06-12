import {
  createCompany,
  enrichCompanyLogo,
  normalizeDomainFromWebsite,
} from "@/src/features/companies/server/createCompanyWithLogo";
import { createAdminClient } from "@/src/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { slugify } from "@/src/lib/slugify";

import type { ImportToDraftResult } from "../types";
import { isUniqueViolation, SponsorImportHttpError } from "./errors";

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
  mapped_tier_label: string | null;
  draft_link_id: string | null;
};

function normalizeCompanyNameKey(name: string): string {
  return name.trim().toLowerCase();
}

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

async function findExistingCompanyId(
  supabase: SupabaseClient,
  name: string,
  website: string | null,
): Promise<string | null> {
  const { data: byName, error: nameError } = await supabase
    .from("companies")
    .select("id")
    .eq("name", name)
    .maybeSingle();
  if (nameError) throw new Error(nameError.message);
  if (byName?.id) return String(byName.id);

  if (website) {
    const domain = normalizeDomainFromWebsite(website);
    if (domain) {
      const { data: byDomain, error: domainError } = await supabase
        .from("companies")
        .select("id")
        .eq("domain", domain)
        .maybeSingle();
      if (domainError) throw new Error(domainError.message);
      if (byDomain?.id) return String(byDomain.id);
    }
  }

  return null;
}

async function resolveCreateNewCompanyId(
  supabase: SupabaseClient,
  row: ResolvedRow,
  createNewByNameKey: Map<string, string>,
): Promise<{ companyId: string; created: boolean }> {
  const name = row.normalized_company_name?.trim();
  if (!name) {
    throw new SponsorImportHttpError(422, `Row ${row.excel_row_number} missing company name.`);
  }

  const websiteRaw = row.normalized_website?.trim() ?? "";
  const website = websiteRaw !== "" ? websiteRaw : null;
  const nameKey = normalizeCompanyNameKey(name);

  const cachedByName = createNewByNameKey.get(nameKey);
  if (cachedByName) {
    return { companyId: cachedByName, created: false };
  }

  const existingId = await findExistingCompanyId(supabase, name, website);
  if (existingId) {
    createNewByNameKey.set(nameKey, existingId);
    return { companyId: existingId, created: false };
  }

  const slug = await uniqueSlug(row.proposed_slug ?? name);
  try {
    const company = await createCompany({ name, website, slug, city_id: null });
    createNewByNameKey.set(nameKey, company.id);
    if (website) {
      void enrichCompanyLogo(company.id, website);
    }
    return { companyId: company.id, created: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!isUniqueViolation(message)) {
      throw error instanceof Error ? error : new Error(message);
    }

    const racedId = await findExistingCompanyId(supabase, name, website);
    if (!racedId) {
      throw new SponsorImportHttpError(
        409,
        `Could not create company "${name}" for row ${row.excel_row_number}: ${message}`,
      );
    }

    createNewByNameKey.set(nameKey, racedId);
    return { companyId: racedId, created: false };
  }
}

async function resolveCompanyIdForRow(
  supabase: SupabaseClient,
  row: ResolvedRow,
  createdByRowId: Map<string, string>,
  createNewByNameKey: Map<string, string>,
): Promise<{ companyId: string; created: boolean }> {
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
    createdByRowId.set(row.id, result.companyId);
    return result;
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
