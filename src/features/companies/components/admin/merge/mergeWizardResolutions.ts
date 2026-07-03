import {
  defaultCompanyMergeFieldResolutions,
  type CompanyMergePreviewSnapshot,
  type CompanyMergeResolutions,
  type DraftLinkConflictStrategy,
  type OrganizerConflictStrategy,
  type SponsorshipConflictStrategy,
} from "@/src/features/companies/server/companyMerge";

export function buildInitialResolutionsFromPreview(
  preview: CompanyMergePreviewSnapshot,
): CompanyMergeResolutions {
  const sponsorship_conflicts: CompanyMergeResolutions["sponsorship_conflicts"] =
    preview.required_resolutions.sponsorship_conflicts.map((eventEditionId) => ({
      event_edition_id: eventEditionId,
      strategy: "keep_canonical" satisfies SponsorshipConflictStrategy,
    }));

  const organizer_conflicts: CompanyMergeResolutions["organizer_conflicts"] =
    preview.required_resolutions.organizer_conflicts.map((eventEditionId) => ({
      event_edition_id: eventEditionId,
      strategy: "keep_canonical" satisfies OrganizerConflictStrategy,
    }));

  const draft_link_conflicts: CompanyMergeResolutions["draft_link_conflicts"] =
    preview.required_resolutions.draft_link_conflicts.map((batchId) => ({
      batch_id: batchId,
      strategy: "keep_canonical_draft" satisfies DraftLinkConflictStrategy,
    }));

  return {
    schema_version: 2,
    sponsorship_conflicts,
    organizer_conflicts,
    draft_link_conflicts,
    field_resolutions: defaultCompanyMergeFieldResolutions(),
  };
}

export function updateOrganizerStrategy(
  resolutions: CompanyMergeResolutions,
  eventEditionId: string,
  strategy: OrganizerConflictStrategy,
): CompanyMergeResolutions {
  return {
    ...resolutions,
    organizer_conflicts: resolutions.organizer_conflicts.map((entry) =>
      entry.event_edition_id === eventEditionId ? { ...entry, strategy } : entry,
    ),
  };
}

export function updateSponsorshipStrategy(
  resolutions: CompanyMergeResolutions,
  eventEditionId: string,
  strategy: SponsorshipConflictStrategy,
): CompanyMergeResolutions {
  return {
    ...resolutions,
    sponsorship_conflicts: resolutions.sponsorship_conflicts.map((entry) =>
      entry.event_edition_id === eventEditionId ? { ...entry, strategy } : entry,
    ),
  };
}

export function updateDraftLinkStrategy(
  resolutions: CompanyMergeResolutions,
  batchId: string,
  strategy: DraftLinkConflictStrategy,
): CompanyMergeResolutions {
  return {
    ...resolutions,
    draft_link_conflicts: resolutions.draft_link_conflicts.map((entry) =>
      entry.batch_id === batchId ? { ...entry, strategy } : entry,
    ),
  };
}

export type MergeExecuteApiResponse =
  | {
      ok: true;
      merge_id: string;
      canonical_company_id: string;
      duplicate_company_id: string;
      redirect_to?: string;
    }
  | { ok: false; error: string };

export async function executeMergeCompanies(
  input: {
    canonicalCompanyId: string;
    duplicateCompanyId: string;
    confirmation: string;
    resolutions: CompanyMergeResolutions;
    notes?: string | null;
  },
): Promise<MergeExecuteApiResponse & { ok: true }> {
  const res = await fetch("/api/admin/companies/merge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      canonical_company_id: input.canonicalCompanyId,
      duplicate_company_id: input.duplicateCompanyId,
      confirmation: input.confirmation,
      resolutions: input.resolutions,
      notes: input.notes ?? null,
    }),
  });

  const data = (await res.json()) as MergeExecuteApiResponse;

  if (!res.ok || !data.ok) {
    const message = data.ok ? "Merge request failed." : data.error;
    throw new Error(message);
  }

  return data;
}
