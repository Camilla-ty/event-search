const RECOGNITION_LABEL_MAX_LENGTH = 200;
const PRIMARY_SOURCE_URL_MAX_LENGTH = 2048;
const VERSION_LABEL_MAX_LENGTH = 200;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ISO_TIMESTAMP_REGEX =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/;

export type PartnerAlumniVersionHeaderPatch = {
  version_label?: string | null;
  recognition_label?: string | null;
  primary_source_url?: string | null;
  source_checked_at?: string | null;
};

/** @deprecated Use PartnerAlumniVersionHeaderPatch on version rows */
export type PartnerAlumniHeaderPatch = Pick<
  PartnerAlumniVersionHeaderPatch,
  "recognition_label" | "primary_source_url"
>;

export type PartnerAlumniCreateVersionMode = "copy" | "empty";

export type PartnerAlumniCreateMemberPayload = {
  company_id: string;
};

export type PartnerAlumniMoveDirection = "up" | "down";

export type PartnerAlumniReorderPayload = {
  ordered_member_ids: string[];
};

function parseOptionalText(
  raw: unknown,
  fieldName: string,
  maxLength: number,
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined) {
    return { ok: true, value: null };
  }
  if (typeof raw !== "string") {
    return { ok: false, error: `${fieldName} must be a string or null` };
  }
  const trimmed = raw.trim();
  if (trimmed.length > maxLength) {
    return {
      ok: false,
      error: `${fieldName} must be at most ${maxLength} characters`,
    };
  }
  return { ok: true, value: trimmed === "" ? null : trimmed };
}

function parseOptionalTimestamp(
  raw: unknown,
  fieldName: string,
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined) {
    return { ok: true, value: null };
  }
  if (typeof raw !== "string") {
    return { ok: false, error: `${fieldName} must be an ISO timestamp string or null` };
  }
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: true, value: null };
  }
  if (!ISO_TIMESTAMP_REGEX.test(trimmed)) {
    return { ok: false, error: `${fieldName} must be a valid ISO timestamp` };
  }
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    return { ok: false, error: `${fieldName} must be a valid ISO timestamp` };
  }
  return { ok: true, value: new Date(parsed).toISOString() };
}

export function validatePartnerAlumniVersionHeaderPatchBody(
  body: Record<string, unknown>,
):
  | { ok: true; patch: PartnerAlumniVersionHeaderPatch }
  | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const patch: PartnerAlumniVersionHeaderPatch = {};

  if ("version_label" in body) {
    const label = parseOptionalText(body.version_label, "version_label", VERSION_LABEL_MAX_LENGTH);
    if (label.ok) patch.version_label = label.value;
    else errors.push(label.error);
  }

  if ("recognition_label" in body) {
    const label = parseOptionalText(
      body.recognition_label,
      "recognition_label",
      RECOGNITION_LABEL_MAX_LENGTH,
    );
    if (label.ok) patch.recognition_label = label.value;
    else errors.push(label.error);
  }

  if ("primary_source_url" in body) {
    const url = parseOptionalText(
      body.primary_source_url,
      "primary_source_url",
      PRIMARY_SOURCE_URL_MAX_LENGTH,
    );
    if (url.ok) patch.primary_source_url = url.value;
    else errors.push(url.error);
  }

  if ("source_checked_at" in body) {
    const checkedAt = parseOptionalTimestamp(body.source_checked_at, "source_checked_at");
    if (checkedAt.ok) patch.source_checked_at = checkedAt.value;
    else errors.push(checkedAt.error);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, errors: ["No fields to update."] };
  }

  return { ok: true, patch };
}

/** @deprecated Use validatePartnerAlumniVersionHeaderPatchBody */
export function validatePartnerAlumniHeaderPatchBody(
  body: Record<string, unknown>,
):
  | { ok: true; patch: PartnerAlumniHeaderPatch }
  | { ok: false; errors: string[] } {
  const result = validatePartnerAlumniVersionHeaderPatchBody(body);
  if (!result.ok) return result;
  const patch: PartnerAlumniHeaderPatch = {};
  if ("recognition_label" in result.patch) {
    patch.recognition_label = result.patch.recognition_label;
  }
  if ("primary_source_url" in result.patch) {
    patch.primary_source_url = result.patch.primary_source_url;
  }
  if (Object.keys(patch).length === 0) {
    return { ok: false, errors: ["No fields to update."] };
  }
  return { ok: true, patch };
}

export function validatePartnerAlumniCreateVersionBody(
  body: Record<string, unknown>,
):
  | { ok: true; mode: PartnerAlumniCreateVersionMode }
  | { ok: false; errors: string[] } {
  if (!("mode" in body) || body.mode === undefined || body.mode === null) {
    return { ok: true, mode: "copy" };
  }

  if (body.mode === "copy" || body.mode === "empty") {
    return { ok: true, mode: body.mode };
  }

  return { ok: false, errors: ['mode must be "copy" or "empty"'] };
}

export function validatePartnerAlumniCreateMemberBody(
  body: Record<string, unknown>,
):
  | { ok: true; data: PartnerAlumniCreateMemberPayload }
  | { ok: false; errors: string[] } {
  const companyIdRaw = body.company_id;
  const companyId =
    typeof companyIdRaw === "string" && UUID_REGEX.test(companyIdRaw.trim())
      ? companyIdRaw.trim()
      : null;

  if (companyId === null) {
    return { ok: false, errors: ["company_id must be a valid UUID"] };
  }

  return { ok: true, data: { company_id: companyId } };
}

export function validatePartnerAlumniMoveBody(
  body: Record<string, unknown>,
): { ok: true; direction: PartnerAlumniMoveDirection } | { ok: false; errors: string[] } {
  const raw = body.direction;
  if (raw === "up" || raw === "down") {
    return { ok: true, direction: raw };
  }
  return { ok: false, errors: ['direction must be "up" or "down"'] };
}

function parseOrderedMemberIds(
  raw: unknown,
): { ok: true; ids: string[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) {
    return { ok: false, error: "ordered_member_ids must be an array." };
  }
  if (raw.length === 0) {
    return { ok: false, error: "ordered_member_ids must not be empty." };
  }

  const ids: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || !UUID_REGEX.test(item.trim())) {
      return { ok: false, error: "ordered_member_ids must contain valid UUIDs." };
    }
    ids.push(item.trim());
  }

  return { ok: true, ids };
}

export function validatePartnerAlumniReorderBody(
  body: Record<string, unknown>,
):
  | { ok: true; data: PartnerAlumniReorderPayload }
  | { ok: false; errors: string[] } {
  if (!("ordered_member_ids" in body)) {
    return { ok: false, errors: ["ordered_member_ids is required."] };
  }

  const parsed = parseOrderedMemberIds(body.ordered_member_ids);
  if (!parsed.ok) {
    return { ok: false, errors: [parsed.error] };
  }

  return { ok: true, data: { ordered_member_ids: parsed.ids } };
}

export function validatePartnerAlumniMoveMemberBody(
  body: Record<string, unknown>,
):
  | { ok: true; member_id: string; direction: PartnerAlumniMoveDirection }
  | { ok: false; errors: string[] } {
  const errors: string[] = [];

  const memberIdRaw = body.member_id;
  const memberId =
    typeof memberIdRaw === "string" && UUID_REGEX.test(memberIdRaw.trim())
      ? memberIdRaw.trim()
      : null;
  if (memberId === null) {
    errors.push("member_id must be a valid UUID");
  }

  const direction = validatePartnerAlumniMoveBody(body);
  if (!direction.ok) {
    errors.push(...direction.errors);
  }

  if (errors.length > 0 || memberId === null || !direction.ok) {
    return { ok: false, errors };
  }

  return { ok: true, member_id: memberId, direction: direction.direction };
}
