const ROLE_LABEL_MAX_LENGTH = 80;
const DEFAULT_ROLE_LABEL = "Organizer";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type OrganizerMoveDirection = "up" | "down";

export type EventOrganizerCreatePayload = {
  company_id: string;
  role_label: string;
};

export type EventOrganizerUpdatePatch = {
  role_label: string;
};

export type EventOrganizerReorderPayload = {
  organizer_id: string;
  direction: OrganizerMoveDirection;
};

function parseUuid(raw: unknown, fieldLabel: string): { ok: true; id: string } | { ok: false; error: string } {
  if (typeof raw !== "string" || raw.trim() === "") {
    return { ok: false, error: `${fieldLabel} is required.` };
  }
  const id = raw.trim();
  if (!UUID_REGEX.test(id)) {
    return { ok: false, error: `${fieldLabel} must be a valid UUID.` };
  }
  return { ok: true, id };
}

function parseRoleLabel(
  raw: unknown,
  { required }: { required: boolean },
): { ok: true; label: string } | { ok: false; error: string } {
  if (raw === undefined || raw === null) {
    if (required) {
      return { ok: false, error: "role_label is required." };
    }
    return { ok: true, label: DEFAULT_ROLE_LABEL };
  }
  if (typeof raw !== "string") {
    return { ok: false, error: "role_label must be a string." };
  }
  const label = raw.trim();
  if (label === "") {
    return { ok: false, error: "role_label must not be empty." };
  }
  if (label.length > ROLE_LABEL_MAX_LENGTH) {
    return {
      ok: false,
      error: `role_label must be at most ${ROLE_LABEL_MAX_LENGTH} characters.`,
    };
  }
  return { ok: true, label };
}

export function validateEventOrganizerCreateBody(
  body: Record<string, unknown>,
): { ok: true; data: EventOrganizerCreatePayload } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  const companyId = parseUuid(body.company_id, "company_id");
  if (!companyId.ok) {
    errors.push(companyId.error);
  }

  const roleLabel = parseRoleLabel(body.role_label, { required: false });
  if (!roleLabel.ok) {
    errors.push(roleLabel.error);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      company_id: companyId.ok ? companyId.id : "",
      role_label: roleLabel.ok ? roleLabel.label : DEFAULT_ROLE_LABEL,
    },
  };
}

export function validateEventOrganizerUpdateBody(
  body: Record<string, unknown>,
): { ok: true; patch: EventOrganizerUpdatePatch } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const roleLabel = parseRoleLabel(body.role_label, { required: true });
  if (!roleLabel.ok) {
    errors.push(roleLabel.error);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    patch: { role_label: roleLabel.ok ? roleLabel.label : DEFAULT_ROLE_LABEL },
  };
}

export function validateEventOrganizerReorderBody(
  body: Record<string, unknown>,
): { ok: true; data: EventOrganizerReorderPayload } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  const organizerId = parseUuid(body.organizer_id, "organizer_id");
  if (!organizerId.ok) {
    errors.push(organizerId.error);
  }

  const direction = body.direction;
  if (direction !== "up" && direction !== "down") {
    errors.push("direction must be 'up' or 'down'.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      organizer_id: organizerId.ok ? organizerId.id : "",
      direction: direction as OrganizerMoveDirection,
    },
  };
}

export function shouldAutoTouchOrganizerUpdate(
  existingRoleLabel: string,
  patchRoleLabel: string,
): boolean {
  return existingRoleLabel.trim() !== patchRoleLabel.trim();
}
