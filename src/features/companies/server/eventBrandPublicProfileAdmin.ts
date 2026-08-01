import { createAdminClient } from "@/src/lib/supabase/admin";
import { validateEventBrandPublicProfileApproval } from "@/src/lib/companies/eventBrandPublicProfile";
import { findSeriesByCompanyProfileIdAdmin } from "@/src/features/events/server/eventSeriesAdmin";

import { getCompanyAdminById, type CompanyAdminRow } from "./companyAdmin";

export class EventBrandPublicProfileAdminError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "EventBrandPublicProfileAdminError";
    this.status = status;
  }
}

export type EventBrandPublicProfileMutationResult = {
  company: CompanyAdminRow;
};

export async function approveEventBrandPublicProfileAdmin(
  companyId: string,
): Promise<EventBrandPublicProfileMutationResult> {
  const existing = await getCompanyAdminById(companyId);
  if (!existing) {
    throw new EventBrandPublicProfileAdminError("Company not found.", 404);
  }
  if (existing.status === "merged") {
    throw new EventBrandPublicProfileAdminError(
      "Merged companies cannot receive Event Brand public-profile approval.",
      409,
    );
  }

  const sameBrandSeries = await findSeriesByCompanyProfileIdAdmin(companyId);
  const validation = validateEventBrandPublicProfileApproval({
    action: "approve",
    currentApprovedAt: existing.event_brand_public_profile_approved_at,
    sameBrandSeries,
  });
  if (!validation.ok) {
    throw new EventBrandPublicProfileAdminError(validation.error, 400);
  }

  const now = new Date().toISOString();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("companies")
    .update({ event_brand_public_profile_approved_at: now })
    .eq("id", companyId);

  if (error) {
    throw new Error(error.message);
  }

  const company = await getCompanyAdminById(companyId);
  if (!company) {
    throw new Error("Company not found after Event Brand public-profile approval.");
  }

  return { company };
}

export async function revokeEventBrandPublicProfileAdmin(
  companyId: string,
): Promise<EventBrandPublicProfileMutationResult> {
  const existing = await getCompanyAdminById(companyId);
  if (!existing) {
    throw new EventBrandPublicProfileAdminError("Company not found.", 404);
  }

  const validation = validateEventBrandPublicProfileApproval({
    action: "revoke",
    currentApprovedAt: existing.event_brand_public_profile_approved_at,
    sameBrandSeries: null,
  });
  if (!validation.ok) {
    throw new EventBrandPublicProfileAdminError(validation.error, 400);
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("companies")
    .update({ event_brand_public_profile_approved_at: null })
    .eq("id", companyId);

  if (error) {
    throw new Error(error.message);
  }

  const company = await getCompanyAdminById(companyId);
  if (!company) {
    throw new Error("Company not found after revoking Event Brand public-profile approval.");
  }

  return { company };
}
