import { createAdminClient } from "@/src/lib/supabase/admin";
import { validateCompanyLogoUpload } from "@/src/lib/companies/companyLogoUploadValidation";
import { slugify } from "@/src/lib/slugify";

import {
  scheduleEventSeriesLogoCleanupAfterPersist,
  uploadEventSeriesLogoBytes,
  verifyEventSeriesLogoStorageObject,
} from "./eventSeriesLogoStorage";

const EVENT_SERIES_ADMIN_SELECT = `
  id,
  name,
  slug,
  description,
  website_url,
  logo_url,
  lifecycle_status,
  lifecycle_note,
  merged_into_series_id,
  created_at,
  merged_into_series:merged_into_series_id ( id, name, slug )
`;

export type MergedIntoSeriesSummary = {
  id: string;
  name: string;
  slug: string;
};

export type EventSeriesRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  website_url: string | null;
  logo_url: string | null;
  lifecycle_status: string | null;
  lifecycle_note: string | null;
  merged_into_series_id: string | null;
  created_at: string;
  merged_into_series?: MergedIntoSeriesSummary | null;
};

export type CreateEventSeriesInput = {
  name: string;
  slug: string;
  description?: string | null;
  website_url?: string | null;
  logo_url?: string | null;
  lifecycle_status?: string | null;
  lifecycle_note?: string | null;
  merged_into_series_id?: string | null;
};

export type UpdateEventSeriesInput = {
  name?: string;
  slug?: string;
  description?: string | null;
  website_url?: string | null;
  logo_url?: string | null;
  lifecycle_status?: string | null;
  lifecycle_note?: string | null;
  merged_into_series_id?: string | null;
};

export type EventSeriesListItem = EventSeriesRow & {
  edition_count: number;
};

function normalizeMergedIntoSeries(raw: unknown): MergedIntoSeriesSummary | null {
  if (raw === null || raw === undefined) return null;
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (row === null || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : "";
  const name = typeof record.name === "string" ? record.name : "";
  const slug = typeof record.slug === "string" ? record.slug : "";
  if (id === "" || name === "" || slug === "") return null;
  return { id, name, slug };
}

function mapEventSeriesRow(raw: Record<string, unknown>): EventSeriesRow {
  return {
    id: String(raw.id),
    name: typeof raw.name === "string" ? raw.name : "",
    slug: typeof raw.slug === "string" ? raw.slug : "",
    description: typeof raw.description === "string" ? raw.description : null,
    website_url: typeof raw.website_url === "string" ? raw.website_url : null,
    logo_url: typeof raw.logo_url === "string" ? raw.logo_url : null,
    lifecycle_status: typeof raw.lifecycle_status === "string" ? raw.lifecycle_status : null,
    lifecycle_note: typeof raw.lifecycle_note === "string" ? raw.lifecycle_note : null,
    merged_into_series_id:
      typeof raw.merged_into_series_id === "string" ? raw.merged_into_series_id : null,
    created_at: typeof raw.created_at === "string" ? raw.created_at : "",
    merged_into_series: normalizeMergedIntoSeries(raw.merged_into_series),
  };
}

export async function listEventSeriesAdmin(search?: string): Promise<EventSeriesListItem[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("event_series")
    .select(EVENT_SERIES_ADMIN_SELECT)
    .order("name", { ascending: true });

  const term = search?.trim() ?? "";
  if (term !== "") {
    query = query.or(`name.ilike.%${term}%,slug.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const series = (data ?? []).map((row) =>
    mapEventSeriesRow(row as Record<string, unknown>),
  );
  if (series.length === 0) return [];

  const { data: editionRows, error: editionError } = await supabase
    .from("event_editions")
    .select("series_id");

  if (editionError) throw new Error(editionError.message);

  const countBySeries = new Map<string, number>();
  for (const row of editionRows ?? []) {
    const sid = row.series_id;
    if (typeof sid === "string" && sid !== "") {
      countBySeries.set(sid, (countBySeries.get(sid) ?? 0) + 1);
    }
  }

  return series.map((item) => ({
    ...item,
    edition_count: countBySeries.get(item.id) ?? 0,
  }));
}

export async function getEventSeriesAdminById(
  id: string,
): Promise<EventSeriesRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("event_series")
    .select(EVENT_SERIES_ADMIN_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapEventSeriesRow(data as Record<string, unknown>);
}

export async function createEventSeries(
  input: CreateEventSeriesInput,
): Promise<EventSeriesRow> {
  const supabase = createAdminClient();
  const payload = {
    name: input.name.trim(),
    slug: input.slug.trim(),
    description: input.description?.trim() || null,
    website_url: input.website_url?.trim() || null,
    logo_url: input.logo_url?.trim() || null,
    lifecycle_status: input.lifecycle_status?.trim() || null,
    lifecycle_note: input.lifecycle_note?.trim() || null,
    merged_into_series_id: input.merged_into_series_id ?? null,
  };

  const { data, error } = await supabase
    .from("event_series")
    .insert(payload)
    .select(EVENT_SERIES_ADMIN_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return mapEventSeriesRow(data as Record<string, unknown>);
}

export async function updateEventSeries(
  id: string,
  input: UpdateEventSeriesInput,
): Promise<EventSeriesRow> {
  const supabase = createAdminClient();
  const patch: Record<string, unknown> = {};

  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.slug !== undefined) patch.slug = input.slug.trim();
  if (input.description !== undefined) {
    patch.description = input.description?.trim() || null;
  }
  if (input.website_url !== undefined) {
    patch.website_url = input.website_url?.trim() || null;
  }
  if (input.logo_url !== undefined) {
    patch.logo_url = input.logo_url?.trim() || null;
  }
  if (input.lifecycle_status !== undefined) {
    patch.lifecycle_status = input.lifecycle_status?.trim() || null;
  }
  if (input.lifecycle_note !== undefined) {
    patch.lifecycle_note = input.lifecycle_note?.trim() || null;
  }
  if (input.merged_into_series_id !== undefined) {
    patch.merged_into_series_id = input.merged_into_series_id;
  }

  const { data, error } = await supabase
    .from("event_series")
    .update(patch)
    .eq("id", id)
    .select(EVENT_SERIES_ADMIN_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return mapEventSeriesRow(data as Record<string, unknown>);
}

export function defaultSeriesSlug(name: string): string {
  return slugify(name);
}

export type UploadEventSeriesLogoFileInput = {
  bytes: Uint8Array;
  mimeType: string;
};

export type UploadEventSeriesLogoFileAdminResult =
  | { ok: true; series: EventSeriesRow }
  | { ok: false; status: 400 | 404 | 500; error: string };

export async function uploadEventSeriesLogoFileAdmin(
  seriesId: string,
  input: UploadEventSeriesLogoFileInput,
): Promise<UploadEventSeriesLogoFileAdminResult> {
  const existing = await getEventSeriesAdminById(seriesId);
  if (!existing) {
    return { ok: false, status: 404, error: "Series not found." };
  }

  const validation = validateCompanyLogoUpload({
    bytes: input.bytes,
    mimeType: input.mimeType,
  });
  if (!validation.ok) {
    return { ok: false, status: 400, error: validation.message };
  }

  const upload = await uploadEventSeriesLogoBytes({
    seriesId,
    bytes: input.bytes,
    contentType: validation.contentType,
  });
  if (!upload.ok) {
    const message =
      upload.error === "file_too_large"
        ? "Logo must be 2 MB or smaller."
        : upload.error === "empty_file"
          ? "Logo file is empty."
          : "Logo upload failed.";
    return { ok: false, status: 500, error: message };
  }

  const verified = await verifyEventSeriesLogoStorageObject(upload.storagePath);
  if (!verified.ok) {
    return { ok: false, status: 500, error: "Uploaded logo could not be verified." };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("event_series")
    .update({ logo_url: upload.publicUrl })
    .eq("id", seriesId)
    .select(EVENT_SERIES_ADMIN_SELECT)
    .single();

  if (error) {
    return { ok: false, status: 500, error: error.message };
  }

  scheduleEventSeriesLogoCleanupAfterPersist({
    seriesId,
    publicUrl: upload.publicUrl,
  });

  return { ok: true, series: mapEventSeriesRow(data as Record<string, unknown>) };
}
