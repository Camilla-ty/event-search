import { createAdminClient } from "@/src/lib/supabase/admin";

export type CompanyMergeSnapshot = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  website: string | null;
  logo_url: string | null;
  logo_source: string | null;
  logo_status: string | null;
  short_description: string | null;
  description: string | null;
  city_id: string | null;
  aliases: string[];
  created_at: string | null;
  status: string;
  merged_into_company_id: string | null;
  sponsor_link_count: number;
};

export type CompanyMergeRequiredResolutions = {
  sponsorship_conflicts: readonly string[];
  draft_link_conflicts: readonly string[];
};

export type CompanyMergePreviewSnapshot = {
  schema_version: number;
  generated_at: string;
  canonical_company_id: string;
  duplicate_company_id: string;
  companies: {
    canonical: CompanyMergeSnapshot;
    duplicate: CompanyMergeSnapshot;
  };
  impact: {
    event_sponsors_to_repoint: number;
    import_rows_proposed_to_repoint: number;
    import_rows_resolved_to_repoint: number;
    draft_links_to_repoint: number;
  };
  sponsorship_conflicts: readonly Record<string, unknown>[];
  draft_link_conflicts: readonly Record<string, unknown>[];
  required_resolutions: CompanyMergeRequiredResolutions;
  field_differences: Record<string, unknown>;
  blockers: readonly string[];
  warnings: readonly string[];
  executable: boolean;
  /** @deprecated Use `executable` — kept for backward compatibility with schema v1 reads */
  executable_in_phase?: boolean;
};

export type CompanyMergePreviewResult = {
  preview_snapshot: CompanyMergePreviewSnapshot;
};

export type SponsorshipConflictStrategy = "keep_canonical" | "keep_duplicate_tier";

export type DraftLinkConflictStrategy = "keep_canonical_draft" | "keep_duplicate_draft";

export type FieldSource = "canonical" | "duplicate";

export type TextFieldStrategy = FieldSource | "longer" | "non_empty";

export type LogoFieldStrategy = FieldSource | "best_available";

export type CompanyMergeFieldResolutions = {
  slug: FieldSource;
  domain: FieldSource | "non_empty";
  website: FieldSource | "non_empty";
  logo: LogoFieldStrategy;
  short_description: TextFieldStrategy;
  description: TextFieldStrategy;
};

export type CompanyMergeResolutions = {
  schema_version: 2;
  sponsorship_conflicts: Array<{
    event_edition_id: string;
    strategy: SponsorshipConflictStrategy;
  }>;
  draft_link_conflicts: Array<{
    batch_id: string;
    strategy: DraftLinkConflictStrategy;
  }>;
  field_resolutions: CompanyMergeFieldResolutions;
};

export type CompanyMergeExecutionActions = {
  soft_archived_duplicate: boolean;
  event_sponsors_repointed: number;
  event_sponsors_deleted: number;
  event_sponsors_updated: number;
  import_rows_proposed_repointed: number;
  import_rows_resolved_repointed: number;
  draft_links_repointed: number;
  draft_links_deleted: number;
  aliases_merged: boolean;
  field_resolutions_applied: boolean;
  slug_redirects_created: number;
  /** @deprecated Phase 1 field */
  import_rows_repointed?: number;
};

export type CompanyMergeExecutionSnapshot = {
  schema_version: number;
  phase: number;
  completed_at: string;
  actions: CompanyMergeExecutionActions;
  repoint_map: Record<string, unknown>;
  canonical_patch?: Record<string, unknown>;
  duplicate_archive?: Record<string, unknown>;
  slug_redirects?: readonly Record<string, unknown>[];
  alias_merge?: Record<string, unknown>;
  resolutions_applied?: Record<string, unknown>;
  /** @deprecated Phase 1 field */
  repoint_deferred?: boolean;
};

export type CompanyMergeExecuteResult = {
  merge_id: string;
  status: "completed";
  canonical_company_id: string;
  duplicate_company_id: string;
  preview_snapshot: CompanyMergePreviewSnapshot;
  execution_snapshot: CompanyMergeExecutionSnapshot;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      result.push(item);
    }
  }
  return result;
}

function readRecordArray(value: unknown): readonly Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  const result: Record<string, unknown>[] = [];
  for (const item of value) {
    if (isRecord(item)) {
      result.push(item);
    }
  }
  return result;
}

function mapCompanyMergeSnapshot(raw: unknown): CompanyMergeSnapshot {
  if (!isRecord(raw)) {
    throw new Error("Invalid company merge snapshot payload.");
  }

  return {
    id: readString(raw.id),
    name: readString(raw.name),
    slug: readString(raw.slug),
    domain: readNullableString(raw.domain),
    website: readNullableString(raw.website),
    logo_url: readNullableString(raw.logo_url),
    logo_source: readNullableString(raw.logo_source),
    logo_status: readNullableString(raw.logo_status),
    short_description: readNullableString(raw.short_description),
    description: readNullableString(raw.description),
    city_id: readNullableString(raw.city_id),
    aliases: readStringArray(raw.aliases),
    created_at: readNullableString(raw.created_at),
    status: readString(raw.status),
    merged_into_company_id: readNullableString(raw.merged_into_company_id),
    sponsor_link_count: readNumber(raw.sponsor_link_count),
  };
}

function mapRequiredResolutions(raw: unknown): CompanyMergeRequiredResolutions {
  if (!isRecord(raw)) {
    return { sponsorship_conflicts: [], draft_link_conflicts: [] };
  }

  return {
    sponsorship_conflicts: readStringArray(raw.sponsorship_conflicts),
    draft_link_conflicts: readStringArray(raw.draft_link_conflicts),
  };
}

function mapCompanyMergePreviewSnapshot(raw: unknown): CompanyMergePreviewSnapshot {
  if (!isRecord(raw)) {
    throw new Error("Invalid company merge preview payload.");
  }

  const companiesRaw = raw.companies;
  if (!isRecord(companiesRaw)) {
    throw new Error("Invalid company merge preview companies payload.");
  }

  const impactRaw = raw.impact;
  if (!isRecord(impactRaw)) {
    throw new Error("Invalid company merge preview impact payload.");
  }

  const executable =
    raw.executable === true ||
    raw.executable_in_phase === true;

  return {
    schema_version: readNumber(raw.schema_version),
    generated_at: readString(raw.generated_at),
    canonical_company_id: readString(raw.canonical_company_id),
    duplicate_company_id: readString(raw.duplicate_company_id),
    companies: {
      canonical: mapCompanyMergeSnapshot(companiesRaw.canonical),
      duplicate: mapCompanyMergeSnapshot(companiesRaw.duplicate),
    },
    impact: {
      event_sponsors_to_repoint: readNumber(impactRaw.event_sponsors_to_repoint),
      import_rows_proposed_to_repoint: readNumber(impactRaw.import_rows_proposed_to_repoint),
      import_rows_resolved_to_repoint: readNumber(impactRaw.import_rows_resolved_to_repoint),
      draft_links_to_repoint: readNumber(impactRaw.draft_links_to_repoint),
    },
    sponsorship_conflicts: readRecordArray(raw.sponsorship_conflicts),
    draft_link_conflicts: readRecordArray(raw.draft_link_conflicts),
    required_resolutions: mapRequiredResolutions(raw.required_resolutions),
    field_differences: isRecord(raw.field_differences) ? raw.field_differences : {},
    blockers: readStringArray(raw.blockers),
    warnings: readStringArray(raw.warnings),
    executable,
    executable_in_phase: raw.executable_in_phase === true ? true : undefined,
  };
}

function mapCompanyMergeExecutionSnapshot(raw: unknown): CompanyMergeExecutionSnapshot {
  if (!isRecord(raw)) {
    throw new Error("Invalid company merge execution payload.");
  }

  const actionsRaw = raw.actions;
  if (!isRecord(actionsRaw)) {
    throw new Error("Invalid company merge execution actions payload.");
  }

  const legacyImportRepointed = readNumber(actionsRaw.import_rows_repointed);
  const proposedRepointed = readNumber(actionsRaw.import_rows_proposed_repointed);
  const resolvedRepointed = readNumber(actionsRaw.import_rows_resolved_repointed);

  return {
    schema_version: readNumber(raw.schema_version),
    phase: readNumber(raw.phase),
    completed_at: readString(raw.completed_at),
    actions: {
      soft_archived_duplicate: actionsRaw.soft_archived_duplicate === true,
      event_sponsors_repointed: readNumber(actionsRaw.event_sponsors_repointed),
      event_sponsors_deleted: readNumber(actionsRaw.event_sponsors_deleted),
      event_sponsors_updated: readNumber(actionsRaw.event_sponsors_updated),
      import_rows_proposed_repointed:
        proposedRepointed > 0 ? proposedRepointed : legacyImportRepointed,
      import_rows_resolved_repointed: resolvedRepointed,
      draft_links_repointed: readNumber(actionsRaw.draft_links_repointed),
      draft_links_deleted: readNumber(actionsRaw.draft_links_deleted),
      aliases_merged: actionsRaw.aliases_merged === true,
      field_resolutions_applied: actionsRaw.field_resolutions_applied === true,
      slug_redirects_created: readNumber(actionsRaw.slug_redirects_created),
      import_rows_repointed:
        legacyImportRepointed > 0 ? legacyImportRepointed : undefined,
    },
    repoint_map: isRecord(raw.repoint_map) ? raw.repoint_map : {},
    canonical_patch: isRecord(raw.canonical_patch) ? raw.canonical_patch : undefined,
    duplicate_archive: isRecord(raw.duplicate_archive) ? raw.duplicate_archive : undefined,
    slug_redirects: readRecordArray(raw.slug_redirects),
    alias_merge: isRecord(raw.alias_merge) ? raw.alias_merge : undefined,
    resolutions_applied: isRecord(raw.resolutions_applied) ? raw.resolutions_applied : undefined,
    repoint_deferred: raw.repoint_deferred === true ? true : undefined,
  };
}

export function mapCompanyMergePreviewResult(raw: unknown): CompanyMergePreviewResult {
  if (!isRecord(raw)) {
    throw new Error("Invalid company merge preview RPC response.");
  }

  return {
    preview_snapshot: mapCompanyMergePreviewSnapshot(raw.preview_snapshot),
  };
}

export function mapCompanyMergeExecuteResult(raw: unknown): CompanyMergeExecuteResult {
  if (!isRecord(raw)) {
    throw new Error("Invalid company merge execute RPC response.");
  }

  const status = readString(raw.status);
  if (status !== "completed") {
    throw new Error("Unexpected company merge status.");
  }

  return {
    merge_id: readString(raw.merge_id),
    status: "completed",
    canonical_company_id: readString(raw.canonical_company_id),
    duplicate_company_id: readString(raw.duplicate_company_id),
    preview_snapshot: mapCompanyMergePreviewSnapshot(raw.preview_snapshot),
    execution_snapshot: mapCompanyMergeExecutionSnapshot(raw.execution_snapshot),
  };
}

export class CompanyMergeRpcError extends Error {
  readonly code: string;

  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = "CompanyMergeRpcError";
    this.code = code;
  }
}

function parseMergeRpcError(message: string): CompanyMergeRpcError {
  const knownCodes = [
    "merge_invalid_company_id",
    "merge_same_company",
    "merge_canonical_not_found",
    "merge_duplicate_not_found",
    "merge_canonical_not_active",
    "merge_duplicate_not_active",
    "merge_canonical_is_merged",
    "merge_would_create_cycle",
    "merge_performed_by_required",
    "merge_performed_by_not_found",
    "merge_dependencies_not_repointed",
    "merge_missing_resolution",
    "merge_invalid_resolution",
    "merge_snapshot_failed",
  ] as const;

  for (const code of knownCodes) {
    if (message.includes(code)) {
      return new CompanyMergeRpcError(code, message);
    }
  }

  return new CompanyMergeRpcError("merge_unknown_error", message);
}

/** Default field resolution picks for merges without explicit overrides. */
export function defaultCompanyMergeFieldResolutions(): CompanyMergeFieldResolutions {
  return {
    slug: "canonical",
    domain: "canonical",
    website: "canonical",
    logo: "best_available",
    short_description: "longer",
    description: "longer",
  };
}

/** Default Phase 2 resolutions envelope (no conflict strategies). */
export function defaultCompanyMergeResolutions(): CompanyMergeResolutions {
  return {
    schema_version: 2,
    sponsorship_conflicts: [],
    draft_link_conflicts: [],
    field_resolutions: defaultCompanyMergeFieldResolutions(),
  };
}

/** Read-only merge impact preview (no writes). */
export async function mergeCompaniesPreview(
  canonicalCompanyId: string,
  duplicateCompanyId: string,
): Promise<CompanyMergePreviewResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("company_merge_preview", {
    p_canonical_company_id: canonicalCompanyId,
    p_duplicate_company_id: duplicateCompanyId,
  });

  if (error) {
    throw parseMergeRpcError(error.message);
  }

  return mapCompanyMergePreviewResult(data);
}

export type MergeCompaniesExecuteInput = {
  canonicalCompanyId: string;
  duplicateCompanyId: string;
  performedBy: string;
  resolutions?: CompanyMergeResolutions | null;
  notes?: string | null;
};

/**
 * Phase 2 execute: repoints dependencies, merges identity, soft-archives duplicate.
 * Supply conflict strategies in `resolutions` when preview.required_resolutions is non-empty.
 */
export async function mergeCompaniesExecute(
  input: MergeCompaniesExecuteInput,
): Promise<CompanyMergeExecuteResult> {
  const supabase = createAdminClient();
  const resolutions = input.resolutions ?? defaultCompanyMergeResolutions();

  const { data, error } = await supabase.rpc("merge_companies", {
    p_canonical_company_id: input.canonicalCompanyId,
    p_duplicate_company_id: input.duplicateCompanyId,
    p_performed_by: input.performedBy,
    p_resolutions: resolutions,
    p_notes: input.notes ?? null,
  });

  if (error) {
    throw parseMergeRpcError(error.message);
  }

  return mapCompanyMergeExecuteResult(data);
}
