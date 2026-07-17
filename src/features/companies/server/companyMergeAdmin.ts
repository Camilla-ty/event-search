import {
  CompanyMergeRpcError,
  defaultCompanyMergeFieldResolutions,
  defaultCompanyMergeResolutions,
  mergeCompaniesExecute,
  mergeCompaniesPreview,
  type CompanyMergeExecuteResult,
  type CompanyMergeFieldResolutions,
  type CompanyMergePreviewSnapshot,
  type CompanyMergeResolutions,
  type DraftLinkConflictStrategy,
  type LogoFieldStrategy,
  type OrganizerConflictStrategy,
  type SponsorshipConflictStrategy,
} from "@/src/features/companies/server/companyMerge";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MERGE_CONFIRMATION = "MERGE";

const SPONSORSHIP_STRATEGIES = new Set<SponsorshipConflictStrategy>([
  "keep_canonical",
  "keep_duplicate_tier",
]);

const ORGANIZER_STRATEGIES = new Set<OrganizerConflictStrategy>([
  "keep_canonical",
  "keep_duplicate_role",
]);

const DRAFT_LINK_STRATEGIES = new Set<DraftLinkConflictStrategy>([
  "keep_canonical_draft",
  "keep_duplicate_draft",
]);

const FIELD_SOURCES = new Set(["canonical", "duplicate"]);

const DOMAIN_WEBSITE_STRATEGIES = new Set(["canonical", "duplicate", "non_empty"]);

const LOGO_STRATEGIES = new Set(["canonical", "duplicate", "best_available"]);

export class CompanyMergeAdminHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "CompanyMergeAdminHttpError";
    this.status = status;
  }
}

export type MergeCompaniesPreviewAdminInput = {
  canonicalCompanyId: string;
  duplicateCompanyId: string;
};

export type MergeCompaniesExecuteAdminInput = {
  canonicalCompanyId: string;
  duplicateCompanyId: string;
  performedBy: string;
  confirmation: string;
  resolutions?: unknown;
  notes?: string | null;
};

export type MergeCompaniesExecuteAdminResult = CompanyMergeExecuteResult & {
  redirect_to: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isCompanyMergeUuid(value: string): boolean {
  return UUID_REGEX.test(value.trim());
}

export function normalizeCompanyMergeUuid(value: string): string {
  return value.trim().toLowerCase();
}

export function parseCompanyMergeUuidParam(
  raw: string | null | undefined,
  fieldLabel: string,
): string {
  const trimmed = raw?.trim() ?? "";
  if (trimmed === "") {
    throw new CompanyMergeAdminHttpError(400, `${fieldLabel} is required.`);
  }
  if (!isCompanyMergeUuid(trimmed)) {
    throw new CompanyMergeAdminHttpError(400, `${fieldLabel} must be a valid UUID.`);
  }
  return normalizeCompanyMergeUuid(trimmed);
}

export function parseCompanyMergePair(input: {
  canonicalCompanyId: string;
  duplicateCompanyId: string;
}): { canonicalCompanyId: string; duplicateCompanyId: string } {
  const canonicalCompanyId = parseCompanyMergeUuidParam(
    input.canonicalCompanyId,
    "canonical_company_id",
  );
  const duplicateCompanyId = parseCompanyMergeUuidParam(
    input.duplicateCompanyId,
    "duplicate_company_id",
  );

  if (canonicalCompanyId === duplicateCompanyId) {
    throw new CompanyMergeAdminHttpError(
      409,
      "Cannot merge a company into itself.",
    );
  }

  return { canonicalCompanyId, duplicateCompanyId };
}

function readStringField(raw: Record<string, unknown>, key: string): string | null {
  const value = raw[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function parseFieldResolutions(raw: unknown): CompanyMergeFieldResolutions {
  if (!isRecord(raw)) {
    throw new CompanyMergeAdminHttpError(400, "field_resolutions must be an object.");
  }

  const slug = readStringField(raw, "slug");
  const domain = readStringField(raw, "domain");
  const website = readStringField(raw, "website");
  const logo = readStringField(raw, "logo");

  if (slug === null || !FIELD_SOURCES.has(slug)) {
    throw new CompanyMergeAdminHttpError(
      400,
      "field_resolutions.slug must be 'canonical' or 'duplicate'.",
    );
  }
  if (domain === null || !DOMAIN_WEBSITE_STRATEGIES.has(domain)) {
    throw new CompanyMergeAdminHttpError(
      400,
      "field_resolutions.domain must be 'canonical', 'duplicate', or 'non_empty'.",
    );
  }
  if (website === null || !DOMAIN_WEBSITE_STRATEGIES.has(website)) {
    throw new CompanyMergeAdminHttpError(
      400,
      "field_resolutions.website must be 'canonical', 'duplicate', or 'non_empty'.",
    );
  }
  if (logo === null || !LOGO_STRATEGIES.has(logo)) {
    throw new CompanyMergeAdminHttpError(
      400,
      "field_resolutions.logo must be 'canonical', 'duplicate', or 'best_available'.",
    );
  }

  const slugSource: CompanyMergeFieldResolutions["slug"] =
    slug === "canonical" ? "canonical" : "duplicate";
  const domainStrategy: CompanyMergeFieldResolutions["domain"] =
    domain === "canonical"
      ? "canonical"
      : domain === "duplicate"
        ? "duplicate"
        : "non_empty";
  const websiteStrategy: CompanyMergeFieldResolutions["website"] =
    website === "canonical"
      ? "canonical"
      : website === "duplicate"
        ? "duplicate"
        : "non_empty";
  const logoStrategy: LogoFieldStrategy =
    logo === "canonical"
      ? "canonical"
      : logo === "duplicate"
        ? "duplicate"
        : "best_available";

  return {
    slug: slugSource,
    domain: domainStrategy,
    website: websiteStrategy,
    logo: logoStrategy,
  };
}

function parseSponsorshipConflicts(raw: unknown): CompanyMergeResolutions["sponsorship_conflicts"] {
  if (!Array.isArray(raw)) {
    throw new CompanyMergeAdminHttpError(
      400,
      "resolutions.sponsorship_conflicts must be an array.",
    );
  }

  const result: CompanyMergeResolutions["sponsorship_conflicts"] = [];

  for (const item of raw) {
    if (!isRecord(item)) {
      throw new CompanyMergeAdminHttpError(
        400,
        "Each sponsorship_conflicts entry must be an object.",
      );
    }
    const eventEditionId = readStringField(item, "event_edition_id");
    const strategy = readStringField(item, "strategy");

    if (eventEditionId === null || !isCompanyMergeUuid(eventEditionId)) {
      throw new CompanyMergeAdminHttpError(
        400,
        "Each sponsorship_conflicts entry requires a valid event_edition_id.",
      );
    }
    if (strategy === null || !SPONSORSHIP_STRATEGIES.has(strategy as SponsorshipConflictStrategy)) {
      throw new CompanyMergeAdminHttpError(
        400,
        "Each sponsorship_conflicts entry requires strategy 'keep_canonical' or 'keep_duplicate_tier'.",
      );
    }

    result.push({
      event_edition_id: normalizeCompanyMergeUuid(eventEditionId),
      strategy: strategy as SponsorshipConflictStrategy,
    });
  }

  return result;
}

function parseOrganizerConflicts(raw: unknown): CompanyMergeResolutions["organizer_conflicts"] {
  if (!Array.isArray(raw)) {
    throw new CompanyMergeAdminHttpError(
      400,
      "resolutions.organizer_conflicts must be an array.",
    );
  }

  const result: CompanyMergeResolutions["organizer_conflicts"] = [];

  for (const item of raw) {
    if (!isRecord(item)) {
      throw new CompanyMergeAdminHttpError(
        400,
        "Each organizer_conflicts entry must be an object.",
      );
    }
    const eventEditionId = readStringField(item, "event_edition_id");
    const strategy = readStringField(item, "strategy");

    if (eventEditionId === null || !isCompanyMergeUuid(eventEditionId)) {
      throw new CompanyMergeAdminHttpError(
        400,
        "Each organizer_conflicts entry requires a valid event_edition_id.",
      );
    }
    if (strategy === null || !ORGANIZER_STRATEGIES.has(strategy as OrganizerConflictStrategy)) {
      throw new CompanyMergeAdminHttpError(
        400,
        "Each organizer_conflicts entry requires strategy 'keep_canonical' or 'keep_duplicate_role'.",
      );
    }

    result.push({
      event_edition_id: normalizeCompanyMergeUuid(eventEditionId),
      strategy: strategy as OrganizerConflictStrategy,
    });
  }

  return result;
}

function parseDraftLinkConflicts(raw: unknown): CompanyMergeResolutions["draft_link_conflicts"] {
  if (!Array.isArray(raw)) {
    throw new CompanyMergeAdminHttpError(
      400,
      "resolutions.draft_link_conflicts must be an array.",
    );
  }

  const result: CompanyMergeResolutions["draft_link_conflicts"] = [];

  for (const item of raw) {
    if (!isRecord(item)) {
      throw new CompanyMergeAdminHttpError(
        400,
        "Each draft_link_conflicts entry must be an object.",
      );
    }
    const batchId = readStringField(item, "batch_id");
    const strategy = readStringField(item, "strategy");

    if (batchId === null || !isCompanyMergeUuid(batchId)) {
      throw new CompanyMergeAdminHttpError(
        400,
        "Each draft_link_conflicts entry requires a valid batch_id.",
      );
    }
    if (strategy === null || !DRAFT_LINK_STRATEGIES.has(strategy as DraftLinkConflictStrategy)) {
      throw new CompanyMergeAdminHttpError(
        400,
        "Each draft_link_conflicts entry requires strategy 'keep_canonical_draft' or 'keep_duplicate_draft'.",
      );
    }

    result.push({
      batch_id: normalizeCompanyMergeUuid(batchId),
      strategy: strategy as DraftLinkConflictStrategy,
    });
  }

  return result;
}

export function parseCompanyMergeResolutions(raw: unknown): CompanyMergeResolutions {
  if (raw === null || raw === undefined) {
    return defaultCompanyMergeResolutions();
  }
  if (!isRecord(raw)) {
    throw new CompanyMergeAdminHttpError(400, "resolutions must be an object.");
  }

  const schemaVersion = raw.schema_version;
  if (schemaVersion !== undefined && schemaVersion !== 2) {
    throw new CompanyMergeAdminHttpError(400, "resolutions.schema_version must be 2.");
  }

  const fieldResolutionsRaw = raw.field_resolutions;
  const field_resolutions =
    fieldResolutionsRaw === undefined
      ? defaultCompanyMergeFieldResolutions()
      : parseFieldResolutions(fieldResolutionsRaw);

  return {
    schema_version: 2,
    sponsorship_conflicts: parseSponsorshipConflicts(raw.sponsorship_conflicts ?? []),
    organizer_conflicts: parseOrganizerConflicts(raw.organizer_conflicts ?? []),
    draft_link_conflicts: parseDraftLinkConflicts(raw.draft_link_conflicts ?? []),
    field_resolutions,
  };
}

export function validateResolutionsAgainstPreview(
  resolutions: CompanyMergeResolutions,
  preview: CompanyMergePreviewSnapshot,
): void {
  const sponsorshipByEdition = new Map<string, SponsorshipConflictStrategy>();
  for (const entry of resolutions.sponsorship_conflicts) {
    sponsorshipByEdition.set(entry.event_edition_id, entry.strategy);
  }

  for (const editionId of preview.required_resolutions.sponsorship_conflicts) {
    const normalized = normalizeCompanyMergeUuid(editionId);
    if (!sponsorshipByEdition.has(normalized)) {
      throw new CompanyMergeAdminHttpError(
        409,
        `Missing sponsorship conflict strategy for edition ${normalized}.`,
      );
    }
  }

  for (const [editionId] of sponsorshipByEdition) {
    const required = preview.required_resolutions.sponsorship_conflicts.map((id) =>
      normalizeCompanyMergeUuid(id),
    );
    if (!required.includes(editionId)) {
      throw new CompanyMergeAdminHttpError(
        400,
        `Unexpected sponsorship conflict strategy for edition ${editionId}.`,
      );
    }
  }

  const organizerByEdition = new Map<string, OrganizerConflictStrategy>();
  for (const entry of resolutions.organizer_conflicts) {
    organizerByEdition.set(entry.event_edition_id, entry.strategy);
  }

  for (const editionId of preview.required_resolutions.organizer_conflicts) {
    const normalized = normalizeCompanyMergeUuid(editionId);
    if (!organizerByEdition.has(normalized)) {
      throw new CompanyMergeAdminHttpError(
        409,
        `Missing organizer conflict strategy for edition ${normalized}.`,
      );
    }
  }

  for (const [editionId] of organizerByEdition) {
    const required = preview.required_resolutions.organizer_conflicts.map((id) =>
      normalizeCompanyMergeUuid(id),
    );
    if (!required.includes(editionId)) {
      throw new CompanyMergeAdminHttpError(
        400,
        `Unexpected organizer conflict strategy for edition ${editionId}.`,
      );
    }
  }

  const draftByBatch = new Map<string, DraftLinkConflictStrategy>();
  for (const entry of resolutions.draft_link_conflicts) {
    draftByBatch.set(entry.batch_id, entry.strategy);
  }

  for (const batchId of preview.required_resolutions.draft_link_conflicts) {
    const normalized = normalizeCompanyMergeUuid(batchId);
    if (!draftByBatch.has(normalized)) {
      throw new CompanyMergeAdminHttpError(
        409,
        `Missing draft link conflict strategy for batch ${normalized}.`,
      );
    }
  }

  for (const [batchId] of draftByBatch) {
    const required = preview.required_resolutions.draft_link_conflicts.map((id) =>
      normalizeCompanyMergeUuid(id),
    );
    if (!required.includes(batchId)) {
      throw new CompanyMergeAdminHttpError(
        400,
        `Unexpected draft link conflict strategy for batch ${batchId}.`,
      );
    }
  }
}

export function mapCompanyMergeRpcErrorToHttp(error: CompanyMergeRpcError): CompanyMergeAdminHttpError {
  const messageByCode: Record<string, { status: number; message: string }> = {
    merge_invalid_company_id: {
      status: 400,
      message: "Invalid company id.",
    },
    merge_same_company: {
      status: 409,
      message: "Cannot merge a company into itself.",
    },
    merge_canonical_not_found: {
      status: 404,
      message: "Canonical company not found.",
    },
    merge_duplicate_not_found: {
      status: 404,
      message: "Duplicate company not found.",
    },
    merge_canonical_not_active: {
      status: 409,
      message: "Canonical company is not active.",
    },
    merge_duplicate_not_active: {
      status: 409,
      message: "Duplicate company is already merged or inactive.",
    },
    merge_canonical_is_merged: {
      status: 409,
      message: "Canonical company is already merged into another company.",
    },
    merge_would_create_cycle: {
      status: 409,
      message: "This merge would create a circular company relationship.",
    },
    merge_performed_by_required: {
      status: 400,
      message: "Admin performer id is required.",
    },
    merge_performed_by_not_found: {
      status: 404,
      message: "Admin profile not found.",
    },
    merge_dependencies_not_repointed: {
      status: 409,
      message: "Duplicate company still has dependencies that require merge resolutions.",
    },
    merge_missing_resolution: {
      status: 409,
      message: "Choose a strategy for every conflicting edition and import batch.",
    },
    merge_invalid_resolution: {
      status: 409,
      message: "Invalid merge conflict strategy.",
    },
    merge_snapshot_failed: {
      status: 500,
      message: "Could not build merge preview snapshot.",
    },
  };

  const mapped = messageByCode[error.code];
  if (mapped) {
    return new CompanyMergeAdminHttpError(mapped.status, mapped.message);
  }

  return new CompanyMergeAdminHttpError(
    500,
    error.message.trim() !== "" ? error.message : "Merge operation failed.",
  );
}

function wrapMergeRpc<T>(operation: () => Promise<T>): Promise<T> {
  return operation().catch((error: unknown) => {
    if (error instanceof CompanyMergeRpcError) {
      throw mapCompanyMergeRpcErrorToHttp(error);
    }
    if (error instanceof CompanyMergeAdminHttpError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new CompanyMergeAdminHttpError(500, message);
  });
}

export async function previewMergeCompaniesAdmin(
  input: MergeCompaniesPreviewAdminInput,
): Promise<CompanyMergePreviewSnapshot> {
  const pair = parseCompanyMergePair(input);

  const result = await wrapMergeRpc(() =>
    mergeCompaniesPreview(pair.canonicalCompanyId, pair.duplicateCompanyId),
  );

  return result.preview_snapshot;
}

export async function executeMergeCompaniesAdmin(
  input: MergeCompaniesExecuteAdminInput,
): Promise<MergeCompaniesExecuteAdminResult> {
  const pair = parseCompanyMergePair({
    canonicalCompanyId: input.canonicalCompanyId,
    duplicateCompanyId: input.duplicateCompanyId,
  });

  const confirmation = input.confirmation.trim();
  if (confirmation !== MERGE_CONFIRMATION) {
    throw new CompanyMergeAdminHttpError(
      400,
      `Confirmation must be exactly "${MERGE_CONFIRMATION}".`,
    );
  }

  const performedBy = parseCompanyMergeUuidParam(input.performedBy, "performed_by");
  const resolutions = parseCompanyMergeResolutions(input.resolutions);

  const preview = await previewMergeCompaniesAdmin({
    canonicalCompanyId: pair.canonicalCompanyId,
    duplicateCompanyId: pair.duplicateCompanyId,
  });

  validateResolutionsAgainstPreview(resolutions, preview);

  const notes =
    typeof input.notes === "string" && input.notes.trim() !== ""
      ? input.notes.trim()
      : null;

  const result = await wrapMergeRpc(() =>
    mergeCompaniesExecute({
      canonicalCompanyId: pair.canonicalCompanyId,
      duplicateCompanyId: pair.duplicateCompanyId,
      performedBy,
      resolutions,
      notes,
    }),
  );

  return {
    ...result,
    redirect_to: `/admin/companies/${pair.canonicalCompanyId}`,
  };
}
