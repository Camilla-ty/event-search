import { createAdminClient } from "@/src/lib/supabase/admin";
import {
  COMPANY_NOT_LINKABLE_MESSAGE,
  isCompanyLinkable,
} from "@/src/lib/companies/assertCompanyLinkable";
import { MERGED_COMPANY_READ_ONLY_MESSAGE } from "@/src/features/companies/server/companyAdmin";

const RELATION_SELECT = "id, company_a_id, company_b_id, created_at";

export type RelatedCompanyAdminRow = {
  relation_id: string;
  company_id: string;
  name: string;
  slug: string;
};

export class CompanyRelatedAdminError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "CompanyRelatedAdminError";
    this.status = status;
  }
}

/** Canonical undirected pair order for company_related_companies. */
export function normalizeRelatedCompanyPair(
  companyIdA: string,
  companyIdB: string,
): { company_a_id: string; company_b_id: string } {
  if (companyIdA === companyIdB) {
    throw new CompanyRelatedAdminError(400, "A company cannot be related to itself.");
  }
  return companyIdA < companyIdB
    ? { company_a_id: companyIdA, company_b_id: companyIdB }
    : { company_a_id: companyIdB, company_b_id: companyIdA };
}

export type AddRelatedCompanyAdminResult =
  | { ok: true; status: "created"; relation_id: string; related: RelatedCompanyAdminRow }
  | { ok: true; status: "already_related"; relation_id: string; related: RelatedCompanyAdminRow };

type CompanyStatusRow = {
  id: string;
  name: string;
  slug: string;
  status: string | null;
  merged_into_company_id: string | null;
};

async function getCompanyStatusRow(companyId: string): Promise<CompanyStatusRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, slug, status, merged_into_company_id")
    .eq("id", companyId)
    .maybeSingle();

  if (error) {
    throw new CompanyRelatedAdminError(500, error.message);
  }
  if (!data) return null;

  return {
    id: String(data.id),
    name: String(data.name),
    slug: String(data.slug),
    status: typeof data.status === "string" ? data.status : null,
    merged_into_company_id:
      typeof data.merged_into_company_id === "string" ? data.merged_into_company_id : null,
  };
}

function mapRelatedRow(
  relationId: string,
  company: Pick<CompanyStatusRow, "id" | "name" | "slug">,
): RelatedCompanyAdminRow {
  return {
    relation_id: relationId,
    company_id: company.id,
    name: company.name,
    slug: company.slug,
  };
}

/** Related companies for one company (both ends of undirected pairs). */
export async function listRelatedCompaniesForAdmin(
  companyId: string,
): Promise<RelatedCompanyAdminRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("company_related_companies")
    .select(RELATION_SELECT)
    .or(`company_a_id.eq.${companyId},company_b_id.eq.${companyId}`);

  if (error) {
    throw new CompanyRelatedAdminError(500, error.message);
  }

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const relatedIds = rows.map((row) => {
    const a = String(row.company_a_id);
    const b = String(row.company_b_id);
    return a === companyId ? b : a;
  });

  const { data: companies, error: companiesError } = await supabase
    .from("companies")
    .select("id, name, slug")
    .in("id", relatedIds);

  if (companiesError) {
    throw new CompanyRelatedAdminError(500, companiesError.message);
  }

  const byId = new Map(
    (companies ?? []).map((row) => [
      String(row.id),
      {
        id: String(row.id),
        name: String(row.name),
        slug: String(row.slug),
      },
    ]),
  );

  const related: RelatedCompanyAdminRow[] = [];
  for (const row of rows) {
    const a = String(row.company_a_id);
    const b = String(row.company_b_id);
    const otherId = a === companyId ? b : a;
    const company = byId.get(otherId);
    if (!company) continue;
    related.push(mapRelatedRow(String(row.id), company));
  }

  return related.sort((left, right) => left.name.localeCompare(right.name));
}

export async function addRelatedCompanyForAdmin(
  companyId: string,
  relatedCompanyId: string,
): Promise<AddRelatedCompanyAdminResult> {
  const current = await getCompanyStatusRow(companyId);
  if (!current) {
    throw new CompanyRelatedAdminError(404, "Company not found.");
  }
  if (!isCompanyLinkable(current)) {
    throw new CompanyRelatedAdminError(409, MERGED_COMPANY_READ_ONLY_MESSAGE);
  }

  const related = await getCompanyStatusRow(relatedCompanyId);
  if (!related) {
    throw new CompanyRelatedAdminError(404, "Related company not found.");
  }
  if (!isCompanyLinkable(related)) {
    throw new CompanyRelatedAdminError(400, COMPANY_NOT_LINKABLE_MESSAGE);
  }

  const pair = normalizeRelatedCompanyPair(companyId, relatedCompanyId);
  const supabase = createAdminClient();

  const { data: existing, error: existingError } = await supabase
    .from("company_related_companies")
    .select("id")
    .eq("company_a_id", pair.company_a_id)
    .eq("company_b_id", pair.company_b_id)
    .maybeSingle();

  if (existingError) {
    throw new CompanyRelatedAdminError(500, existingError.message);
  }

  if (existing?.id) {
    return {
      ok: true,
      status: "already_related",
      relation_id: String(existing.id),
      related: mapRelatedRow(String(existing.id), related),
    };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("company_related_companies")
    .insert(pair)
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: again } = await supabase
        .from("company_related_companies")
        .select("id")
        .eq("company_a_id", pair.company_a_id)
        .eq("company_b_id", pair.company_b_id)
        .maybeSingle();
      if (again?.id) {
        return {
          ok: true,
          status: "already_related",
          relation_id: String(again.id),
          related: mapRelatedRow(String(again.id), related),
        };
      }
    }
    throw new CompanyRelatedAdminError(500, insertError.message);
  }

  return {
    ok: true,
    status: "created",
    relation_id: String(inserted.id),
    related: mapRelatedRow(String(inserted.id), related),
  };
}

export async function removeRelatedCompanyForAdmin(
  companyId: string,
  relationId: string,
): Promise<void> {
  const current = await getCompanyStatusRow(companyId);
  if (!current) {
    throw new CompanyRelatedAdminError(404, "Company not found.");
  }
  if (!isCompanyLinkable(current)) {
    throw new CompanyRelatedAdminError(409, MERGED_COMPANY_READ_ONLY_MESSAGE);
  }

  const supabase = createAdminClient();
  const { data: row, error: loadError } = await supabase
    .from("company_related_companies")
    .select("id, company_a_id, company_b_id")
    .eq("id", relationId)
    .maybeSingle();

  if (loadError) {
    throw new CompanyRelatedAdminError(500, loadError.message);
  }
  if (!row) {
    throw new CompanyRelatedAdminError(404, "Related company link not found.");
  }

  const a = String(row.company_a_id);
  const b = String(row.company_b_id);
  if (a !== companyId && b !== companyId) {
    throw new CompanyRelatedAdminError(404, "Related company link not found.");
  }

  const { error: deleteError } = await supabase
    .from("company_related_companies")
    .delete()
    .eq("id", relationId);

  if (deleteError) {
    throw new CompanyRelatedAdminError(500, deleteError.message);
  }
}
