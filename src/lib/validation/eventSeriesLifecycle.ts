import {
  isEventLifecycleStatus,
  parseOptionalLifecycleStatus,
} from "@/src/lib/validation/eventLifecycleStatus";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SeriesLifecycleState = {
  lifecycle_status: string | null;
  merged_into_series_id: string | null;
};

function parseOptionalUuid(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value === "") return null;
  return UUID_REGEX.test(value) ? value : null;
}

export function parseSeriesLifecycleFields(body: {
  lifecycle_status?: unknown;
  merged_into_series_id?: unknown;
}): { ok: true; partial: Partial<SeriesLifecycleState> } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const partial: Partial<SeriesLifecycleState> = {};

  if (body.lifecycle_status !== undefined) {
    const parsed = parseOptionalLifecycleStatus(body.lifecycle_status);
    if (parsed !== null && parsed !== undefined && !isEventLifecycleStatus(parsed)) {
      errors.push("lifecycle_status must be active, discontinued, or merged");
    } else {
      partial.lifecycle_status = parsed ?? null;
    }
  }

  if (body.merged_into_series_id !== undefined) {
    const parsed = parseOptionalUuid(body.merged_into_series_id);
    if (
      body.merged_into_series_id !== null &&
      body.merged_into_series_id !== "" &&
      parsed === null
    ) {
      errors.push("merged_into_series_id must be a valid UUID");
    } else {
      partial.merged_into_series_id = parsed;
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, partial };
}

export function resolveSeriesLifecycleState(
  existing: SeriesLifecycleState,
  partial: Partial<SeriesLifecycleState>,
): SeriesLifecycleState {
  const merged: SeriesLifecycleState = {
    lifecycle_status:
      partial.lifecycle_status !== undefined
        ? partial.lifecycle_status
        : existing.lifecycle_status,
    merged_into_series_id:
      partial.merged_into_series_id !== undefined
        ? partial.merged_into_series_id
        : existing.merged_into_series_id,
  };

  if (merged.lifecycle_status !== "merged") {
    merged.merged_into_series_id = null;
  }

  return merged;
}

export function validateSeriesLifecycleState(
  state: SeriesLifecycleState,
  seriesId?: string,
): string[] {
  const errors: string[] = [];

  if (state.lifecycle_status === "merged" && state.merged_into_series_id === null) {
    errors.push("merged_into_series_id is required when lifecycle_status is merged");
  }
  if (state.merged_into_series_id !== null && state.lifecycle_status !== "merged") {
    errors.push("merged_into_series_id is only allowed when lifecycle_status is merged");
  }
  if (
    state.merged_into_series_id !== null &&
    seriesId &&
    state.merged_into_series_id === seriesId.trim()
  ) {
    errors.push("An event brand cannot be merged into itself");
  }

  return errors;
}

export function validateSeriesLifecycleUpdate(
  existing: SeriesLifecycleState,
  body: {
    lifecycle_status?: unknown;
    merged_into_series_id?: unknown;
  },
  seriesId?: string,
): { ok: true; patch: Partial<SeriesLifecycleState> } | { ok: false; errors: string[] } {
  const parsed = parseSeriesLifecycleFields(body);
  if (!parsed.ok) {
    return parsed;
  }

  if (Object.keys(parsed.partial).length === 0) {
    return { ok: true, patch: {} };
  }

  const resolved = resolveSeriesLifecycleState(existing, parsed.partial);
  const errors = validateSeriesLifecycleState(resolved, seriesId);
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    patch: {
      lifecycle_status: resolved.lifecycle_status,
      merged_into_series_id: resolved.merged_into_series_id,
    },
  };
}

export function validateSeriesLifecycleCreate(body: {
  lifecycle_status?: unknown;
  merged_into_series_id?: unknown;
}): { ok: true; data: SeriesLifecycleState } | { ok: false; errors: string[] } {
  const parsed = parseSeriesLifecycleFields(body);
  if (!parsed.ok) {
    return parsed;
  }

  const resolved = resolveSeriesLifecycleState(
    {
      lifecycle_status: null,
      merged_into_series_id: null,
    },
    parsed.partial,
  );
  const errors = validateSeriesLifecycleState(resolved);
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, data: resolved };
}
