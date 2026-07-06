import {
  computeMoveOrderedMemberIds,
  validateVersionMemberReorderIds,
} from "@/src/features/partner-alumni/server/partnerAlumniReorder";
import {
  DELETE_CURRENT_VERSION_MESSAGE,
  DUPLICATE_PARTNER_ALUMNI_MEMBER_MESSAGE,
  PartnerAlumniAdminError,
  PROGRAM_NOT_FOUND_MESSAGE,
  SET_CURRENT_ZERO_MEMBERS_MESSAGE,
  VERSION_NOT_FOUND_MESSAGE,
} from "@/src/features/partner-alumni/server/partnerAlumniAdminError";
import { createAdminClient } from "@/src/lib/supabase/admin";
import type {
  PartnerAlumniCreateVersionMode,
  PartnerAlumniMoveDirection,
  PartnerAlumniReorderPayload,
  PartnerAlumniVersionHeaderPatch,
} from "@/src/lib/validation/partnerAlumni";

export {
  DUPLICATE_PARTNER_ALUMNI_MEMBER_MESSAGE,
  DELETE_CURRENT_VERSION_MESSAGE,
  SET_CURRENT_ZERO_MEMBERS_MESSAGE,
  VERSION_NOT_FOUND_MESSAGE,
  PartnerAlumniAdminError,
  mapPartnerAlumniAdminError,
} from "@/src/features/partner-alumni/server/partnerAlumniAdminError";

const UNIQUE_VIOLATION_CODE = "23505";

const PROGRAM_SELECT =
  "id, event_series_id, current_version_id, created_at, updated_at";

const VERSION_SELECT =
  "id, event_partner_alumni_id, version_label, recognition_label, primary_source_url, source_checked_at, created_at, updated_at";

const VERSION_MEMBER_SELECT =
  "id, event_partner_alumni_version_id, company_id, display_order, created_at, updated_at, companies ( id, name, domain )";

export type PartnerAlumniProgramAdminRow = {
  id: string;
  event_series_id: string;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PartnerAlumniVersionMemberAdminRow = {
  id: string;
  event_partner_alumni_version_id: string;
  company_id: string;
  display_order: number;
  created_at: string;
  updated_at: string;
  companies: {
    id: string;
    name: string;
    domain: string | null;
  } | null;
};

export type PartnerAlumniVersionSummary = {
  id: string;
  version_label: string | null;
  recognition_label: string | null;
  primary_source_url: string | null;
  source_checked_at: string | null;
  created_at: string;
  updated_at: string;
  member_count: number;
  is_current: boolean;
};

export type PartnerAlumniVersionDetail = PartnerAlumniVersionSummary & {
  members: PartnerAlumniVersionMemberAdminRow[];
};

export type PartnerAlumniAdminData = {
  program: PartnerAlumniProgramAdminRow | null;
  versions: PartnerAlumniVersionSummary[];
  selected_version: PartnerAlumniVersionDetail | null;
};

type AdminClient = ReturnType<typeof createAdminClient>;

type VersionHeaderFields = {
  version_label: string | null;
  recognition_label: string | null;
  primary_source_url: string | null;
  source_checked_at: string | null;
};

function mapCompanyEmbed(raw: unknown): PartnerAlumniVersionMemberAdminRow["companies"] {
  if (raw === null || raw === undefined) return null;
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (row === null || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : "";
  const name = typeof record.name === "string" ? record.name : "";
  const domain = typeof record.domain === "string" ? record.domain : null;
  if (id === "" || name === "") return null;
  return { id, name, domain };
}

function mapProgramRow(raw: Record<string, unknown>): PartnerAlumniProgramAdminRow {
  return {
    id: String(raw.id),
    event_series_id: String(raw.event_series_id),
    current_version_id:
      typeof raw.current_version_id === "string" ? raw.current_version_id : null,
    created_at: String(raw.created_at),
    updated_at: String(raw.updated_at),
  };
}

function readNullableIsoTimestamp(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return null;
}

function mapVersionRow(raw: Record<string, unknown>): Omit<PartnerAlumniVersionSummary, "member_count" | "is_current"> {
  return {
    id: String(raw.id),
    version_label: typeof raw.version_label === "string" ? raw.version_label : null,
    recognition_label:
      typeof raw.recognition_label === "string" ? raw.recognition_label : null,
    primary_source_url:
      typeof raw.primary_source_url === "string" ? raw.primary_source_url : null,
    source_checked_at: readNullableIsoTimestamp(raw.source_checked_at),
    created_at: String(raw.created_at),
    updated_at: String(raw.updated_at),
  };
}

function mapVersionMemberRow(raw: Record<string, unknown>): PartnerAlumniVersionMemberAdminRow {
  return {
    id: String(raw.id),
    event_partner_alumni_version_id: String(raw.event_partner_alumni_version_id),
    company_id: String(raw.company_id),
    display_order: typeof raw.display_order === "number" ? raw.display_order : 0,
    created_at: String(raw.created_at),
    updated_at: String(raw.updated_at),
    companies: mapCompanyEmbed(raw.companies),
  };
}

async function countVersionMembers(
  supabase: AdminClient,
  versionId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("event_partner_alumni_version_companies")
    .select("id", { count: "exact", head: true })
    .eq("event_partner_alumni_version_id", versionId);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function attachVersionSummaries(
  supabase: AdminClient,
  rows: Array<Omit<PartnerAlumniVersionSummary, "member_count" | "is_current">>,
  currentVersionId: string | null,
): Promise<PartnerAlumniVersionSummary[]> {
  const summaries: PartnerAlumniVersionSummary[] = [];
  for (const row of rows) {
    const member_count = await countVersionMembers(supabase, row.id);
    summaries.push({
      ...row,
      member_count,
      is_current: currentVersionId !== null && row.id === currentVersionId,
    });
  }
  return summaries;
}

function resolveDefaultSelectedVersionId(
  program: PartnerAlumniProgramAdminRow | null,
  versions: PartnerAlumniVersionSummary[],
): string | null {
  if (versions.length === 0) return null;
  if (program?.current_version_id) {
    const current = versions.find((version) => version.id === program.current_version_id);
    if (current) return current.id;
  }
  return versions[0]?.id ?? null;
}

async function loadVersionMembersForVersion(
  supabase: AdminClient,
  versionId: string,
): Promise<PartnerAlumniVersionMemberAdminRow[]> {
  const { data, error } = await supabase
    .from("event_partner_alumni_version_companies")
    .select(VERSION_MEMBER_SELECT)
    .eq("event_partner_alumni_version_id", versionId)
    .order("display_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapVersionMemberRow(row as Record<string, unknown>));
}

async function buildVersionDetail(
  supabase: AdminClient,
  version: PartnerAlumniVersionSummary,
): Promise<PartnerAlumniVersionDetail> {
  const members = await loadVersionMembersForVersion(supabase, version.id);
  return { ...version, members };
}

async function getVersionSummaryForProgram(
  supabase: AdminClient,
  programId: string,
  versionId: string,
  currentVersionId: string | null,
): Promise<PartnerAlumniVersionSummary | null> {
  const { data, error } = await supabase
    .from("event_partner_alumni_versions")
    .select(VERSION_SELECT)
    .eq("id", versionId)
    .eq("event_partner_alumni_id", programId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = mapVersionRow(data as Record<string, unknown>);
  const member_count = await countVersionMembers(supabase, versionId);
  return {
    ...row,
    member_count,
    is_current: currentVersionId !== null && versionId === currentVersionId,
  };
}

export async function assertVersionBelongsToSeries(
  seriesId: string,
  versionId: string,
): Promise<{ program: PartnerAlumniProgramAdminRow; version: PartnerAlumniVersionSummary }> {
  const program = await getPartnerAlumniProgramBySeriesId(seriesId);
  if (!program) {
    throw new PartnerAlumniAdminError(PROGRAM_NOT_FOUND_MESSAGE, 404);
  }

  const supabase = createAdminClient();
  const version = await getVersionSummaryForProgram(
    supabase,
    program.id,
    versionId,
    program.current_version_id,
  );
  if (!version) {
    throw new PartnerAlumniAdminError(VERSION_NOT_FOUND_MESSAGE, 404);
  }

  return { program, version };
}

export async function getPartnerAlumniProgramBySeriesId(
  seriesId: string,
): Promise<PartnerAlumniProgramAdminRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("event_partner_alumni")
    .select(PROGRAM_SELECT)
    .eq("event_series_id", seriesId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapProgramRow(data as Record<string, unknown>) : null;
}

export async function getPartnerAlumniAdminBySeriesId(
  seriesId: string,
  options?: { selectedVersionId?: string | null },
): Promise<PartnerAlumniAdminData> {
  const supabase = createAdminClient();
  const program = await getPartnerAlumniProgramBySeriesId(seriesId);

  if (!program) {
    return {
      program: null,
      versions: [],
      selected_version: null,
    };
  }

  const { data: versionRows, error } = await supabase
    .from("event_partner_alumni_versions")
    .select(VERSION_SELECT)
    .eq("event_partner_alumni_id", program.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) throw new Error(error.message);

  const versions = await attachVersionSummaries(
    supabase,
    (versionRows ?? []).map((row) => mapVersionRow(row as Record<string, unknown>)),
    program.current_version_id,
  );

  const selectedVersionId =
    options?.selectedVersionId !== undefined
      ? options.selectedVersionId
      : resolveDefaultSelectedVersionId(program, versions);

  let selected_version: PartnerAlumniVersionDetail | null = null;
  if (selectedVersionId !== null) {
    const summary = versions.find((version) => version.id === selectedVersionId) ?? null;
    if (summary) {
      selected_version = await buildVersionDetail(supabase, summary);
    }
  }

  return {
    program,
    versions,
    selected_version,
  };
}

export async function ensurePartnerAlumniProgramForSeries(
  seriesId: string,
): Promise<PartnerAlumniProgramAdminRow> {
  const existing = await getPartnerAlumniProgramBySeriesId(seriesId);
  if (existing) return existing;

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("event_partner_alumni")
    .insert({
      event_series_id: seriesId,
      created_at: now,
      updated_at: now,
    })
    .select(PROGRAM_SELECT)
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION_CODE) {
      const raced = await getPartnerAlumniProgramBySeriesId(seriesId);
      if (raced) return raced;
    }
    throw new Error(error.message);
  }

  return mapProgramRow(data as Record<string, unknown>);
}

async function loadVersionHeaderFields(
  supabase: AdminClient,
  versionId: string,
): Promise<VersionHeaderFields | null> {
  const { data, error } = await supabase
    .from("event_partner_alumni_versions")
    .select("version_label, recognition_label, primary_source_url, source_checked_at")
    .eq("id", versionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as Record<string, unknown>;
  return {
    version_label: typeof row.version_label === "string" ? row.version_label : null,
    recognition_label:
      typeof row.recognition_label === "string" ? row.recognition_label : null,
    primary_source_url:
      typeof row.primary_source_url === "string" ? row.primary_source_url : null,
    source_checked_at: readNullableIsoTimestamp(row.source_checked_at),
  };
}

export async function createPartnerAlumniVersionAdmin(
  seriesId: string,
  mode: PartnerAlumniCreateVersionMode = "copy",
): Promise<PartnerAlumniAdminData> {
  const program = await ensurePartnerAlumniProgramForSeries(seriesId);
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  let header: VersionHeaderFields = {
    version_label: null,
    recognition_label: null,
    primary_source_url: null,
    source_checked_at: null,
  };
  let membersToCopy: PartnerAlumniVersionMemberAdminRow[] = [];

  if (mode === "copy" && program.current_version_id !== null) {
    const currentHeader = await loadVersionHeaderFields(supabase, program.current_version_id);
    if (currentHeader) {
      header = { ...currentHeader };
    }
    membersToCopy = await loadVersionMembersForVersion(supabase, program.current_version_id);
  }

  const { data: version, error: versionError } = await supabase
    .from("event_partner_alumni_versions")
    .insert({
      event_partner_alumni_id: program.id,
      version_label: header.version_label,
      recognition_label: header.recognition_label,
      primary_source_url: header.primary_source_url,
      source_checked_at: header.source_checked_at,
      created_at: now,
      updated_at: now,
    })
    .select(VERSION_SELECT)
    .single();

  if (versionError) throw new Error(versionError.message);

  const versionId = String((version as Record<string, unknown>).id);

  if (membersToCopy.length > 0) {
    const memberRows = membersToCopy.map((member) => ({
      event_partner_alumni_version_id: versionId,
      company_id: member.company_id,
      display_order: member.display_order,
      created_at: now,
      updated_at: now,
    }));

    const { error: membersError } = await supabase
      .from("event_partner_alumni_version_companies")
      .insert(memberRows);

    if (membersError) {
      await supabase.from("event_partner_alumni_versions").delete().eq("id", versionId);
      throw new Error(membersError.message);
    }
  }

  return getPartnerAlumniAdminBySeriesId(seriesId, { selectedVersionId: versionId });
}

export async function updatePartnerAlumniVersionHeaderAdmin(
  seriesId: string,
  versionId: string,
  patch: PartnerAlumniVersionHeaderPatch,
): Promise<PartnerAlumniAdminData> {
  await assertVersionBelongsToSeries(seriesId, versionId);

  const supabase = createAdminClient();
  const writePatch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if ("version_label" in patch) writePatch.version_label = patch.version_label;
  if ("recognition_label" in patch) writePatch.recognition_label = patch.recognition_label;
  if ("primary_source_url" in patch) writePatch.primary_source_url = patch.primary_source_url;
  if ("source_checked_at" in patch) writePatch.source_checked_at = patch.source_checked_at;

  const { error } = await supabase
    .from("event_partner_alumni_versions")
    .update(writePatch)
    .eq("id", versionId);

  if (error) throw new Error(error.message);
  return getPartnerAlumniAdminBySeriesId(seriesId, { selectedVersionId: versionId });
}

export async function deletePartnerAlumniVersionAdmin(
  seriesId: string,
  versionId: string,
): Promise<PartnerAlumniAdminData> {
  const { program, version } = await assertVersionBelongsToSeries(seriesId, versionId);

  if (program.current_version_id === version.id) {
    throw new PartnerAlumniAdminError(DELETE_CURRENT_VERSION_MESSAGE, 409);
  }

  const supabase = createAdminClient();
  const { error: membersError } = await supabase
    .from("event_partner_alumni_version_companies")
    .delete()
    .eq("event_partner_alumni_version_id", versionId);

  if (membersError) throw new Error(membersError.message);

  const { data, error } = await supabase
    .from("event_partner_alumni_versions")
    .delete()
    .eq("id", versionId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    throw new PartnerAlumniAdminError(VERSION_NOT_FOUND_MESSAGE, 404);
  }

  const fallbackVersionId = resolveDefaultSelectedVersionId(
    {
      ...program,
      current_version_id:
        program.current_version_id === versionId ? null : program.current_version_id,
    },
    (await getPartnerAlumniAdminBySeriesId(seriesId)).versions.filter(
      (row) => row.id !== versionId,
    ),
  );

  return getPartnerAlumniAdminBySeriesId(seriesId, { selectedVersionId: fallbackVersionId });
}

export async function setPartnerAlumniCurrentVersionAdmin(
  seriesId: string,
  versionId: string,
): Promise<PartnerAlumniAdminData> {
  const { program, version } = await assertVersionBelongsToSeries(seriesId, versionId);

  if (version.member_count < 1) {
    throw new PartnerAlumniAdminError(SET_CURRENT_ZERO_MEMBERS_MESSAGE, 409);
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("event_partner_alumni")
    .update({
      current_version_id: versionId,
      updated_at: now,
    })
    .eq("id", program.id);

  if (error) throw new Error(error.message);
  return getPartnerAlumniAdminBySeriesId(seriesId, { selectedVersionId: versionId });
}

async function nextVersionMemberDisplayOrder(
  supabase: AdminClient,
  versionId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("event_partner_alumni_version_companies")
    .select("display_order")
    .eq("event_partner_alumni_version_id", versionId)
    .order("display_order", { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);

  const first = (data ?? [])[0];
  const max =
    first && typeof first.display_order === "number" ? first.display_order : 0;
  return max + 1;
}

async function renumberVersionMembersDense(
  supabase: AdminClient,
  versionId: string,
  orderedMemberIds: readonly string[],
): Promise<void> {
  const siblings = await loadVersionMembersForVersion(supabase, versionId);
  const validation = validateVersionMemberReorderIds(
    orderedMemberIds,
    siblings.map((row) => row.id),
  );
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const siblingsById = new Map(siblings.map((row) => [row.id, row]));
  const now = new Date().toISOString();

  for (let position = 0; position < orderedMemberIds.length; position += 1) {
    const memberId = orderedMemberIds[position];
    if (memberId === undefined) {
      throw new Error("Version roster ordering is out of sync. Reload and try again.");
    }

    const row = siblingsById.get(memberId);
    if (row === undefined) {
      throw new Error("Version roster ordering is out of sync. Reload and try again.");
    }

    const desiredOrder = position + 1;
    if (row.display_order === desiredOrder) continue;

    const { error } = await supabase
      .from("event_partner_alumni_version_companies")
      .update({ display_order: desiredOrder, updated_at: now })
      .eq("id", row.id);

    if (error) throw new Error(error.message);
  }
}

export async function addPartnerAlumniVersionMemberAdmin(
  seriesId: string,
  versionId: string,
  companyId: string,
): Promise<PartnerAlumniAdminData> {
  await assertVersionBelongsToSeries(seriesId, versionId);

  const supabase = createAdminClient();
  const displayOrder = await nextVersionMemberDisplayOrder(supabase, versionId);
  const now = new Date().toISOString();

  const { error } = await supabase.from("event_partner_alumni_version_companies").insert({
    event_partner_alumni_version_id: versionId,
    company_id: companyId,
    display_order: displayOrder,
    created_at: now,
    updated_at: now,
  });

  if (error) {
    if (error.code === UNIQUE_VIOLATION_CODE) {
      throw new PartnerAlumniAdminError(DUPLICATE_PARTNER_ALUMNI_MEMBER_MESSAGE, 409);
    }
    throw new Error(error.message);
  }

  return getPartnerAlumniAdminBySeriesId(seriesId, { selectedVersionId: versionId });
}

export async function removePartnerAlumniVersionMemberAdmin(
  seriesId: string,
  versionId: string,
  memberId: string,
): Promise<PartnerAlumniAdminData> {
  await assertVersionBelongsToSeries(seriesId, versionId);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("event_partner_alumni_version_companies")
    .delete()
    .eq("id", memberId)
    .eq("event_partner_alumni_version_id", versionId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    throw new PartnerAlumniAdminError("Version member not found.", 404);
  }

  const remaining = await loadVersionMembersForVersion(supabase, versionId);
  if (remaining.length > 0) {
    await renumberVersionMembersDense(
      supabase,
      versionId,
      remaining.map((row) => row.id),
    );
  }

  return getPartnerAlumniAdminBySeriesId(seriesId, { selectedVersionId: versionId });
}

export async function reorderPartnerAlumniVersionMembersAdmin(
  seriesId: string,
  versionId: string,
  payload: PartnerAlumniReorderPayload,
): Promise<PartnerAlumniAdminData> {
  await assertVersionBelongsToSeries(seriesId, versionId);

  const supabase = createAdminClient();
  await renumberVersionMembersDense(supabase, versionId, payload.ordered_member_ids);
  return getPartnerAlumniAdminBySeriesId(seriesId, { selectedVersionId: versionId });
}

export async function movePartnerAlumniVersionMemberAdmin(
  seriesId: string,
  versionId: string,
  memberId: string,
  direction: PartnerAlumniMoveDirection,
): Promise<PartnerAlumniAdminData> {
  await assertVersionBelongsToSeries(seriesId, versionId);

  const supabase = createAdminClient();
  const siblings = await loadVersionMembersForVersion(supabase, versionId);
  const orderedMemberIds = siblings.map((row) => row.id);
  const nextOrder = computeMoveOrderedMemberIds(orderedMemberIds, memberId, direction);

  if (nextOrder === null) {
    if (!orderedMemberIds.includes(memberId)) {
      throw new PartnerAlumniAdminError("Version member not found.", 404);
    }
    return getPartnerAlumniAdminBySeriesId(seriesId, { selectedVersionId: versionId });
  }

  await renumberVersionMembersDense(supabase, versionId, nextOrder);
  return getPartnerAlumniAdminBySeriesId(seriesId, { selectedVersionId: versionId });
}
