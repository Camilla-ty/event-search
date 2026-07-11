import { createAdminClient } from "@/src/lib/supabase/admin";

import { getCompanyAdminById, type CompanyAdminRow } from "./companyAdmin";

export class CompanyRestrictionAdminError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CompanyRestrictionAdminError";
    this.status = status;
  }
}

export const MERGED_COMPANY_CANNOT_BE_RESTRICTED_MESSAGE =
  "Merged companies cannot be restricted.";

export type CompanyRestrictionMutationResult = {
  company: CompanyAdminRow;
};

export async function restrictCompanyAdmin(
  id: string,
): Promise<CompanyRestrictionMutationResult> {
  const existing = await getCompanyAdminById(id);
  if (!existing) {
    throw new CompanyRestrictionAdminError("Company not found.", 404);
  }
  if (existing.status === "merged") {
    throw new CompanyRestrictionAdminError(MERGED_COMPANY_CANNOT_BE_RESTRICTED_MESSAGE, 409);
  }
  if (existing.restricted_at !== null) {
    return { company: existing };
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("companies")
    .update({ restricted_at: now })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  const company = await getCompanyAdminById(id);
  if (!company) {
    throw new Error("Company not found after restriction.");
  }

  return { company };
}

export async function unrestrictCompanyAdmin(
  id: string,
): Promise<CompanyRestrictionMutationResult> {
  const existing = await getCompanyAdminById(id);
  if (!existing) {
    throw new CompanyRestrictionAdminError("Company not found.", 404);
  }
  if (existing.restricted_at === null) {
    return { company: existing };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("companies")
    .update({ restricted_at: null })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  const company = await getCompanyAdminById(id);
  if (!company) {
    throw new Error("Company not found after restoring visibility.");
  }

  return { company };
}
