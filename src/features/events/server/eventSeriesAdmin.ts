import { createAdminClient } from "@/src/lib/supabase/admin";
import { validateCompanyLogoUpload } from "@/src/lib/companies/companyLogoUploadValidation";
import { slugify } from "@/src/lib/slugify";

import {
  scheduleEventSeriesLogoCleanupAfterPersist,
  uploadEventSeriesLogoBytes,
  verifyEventSeriesLogoStorageObject,
} from "./eventSeriesLogoStorage";

export type EventSeriesRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  website_url: string | null;
  logo_url: string | null;
  lifecycle_status: string | null;
  lifecycle_note: string | null;
  created_at: string;
};

export type CreateEventSeriesInput = {
  name: string;
  slug: string;
  description?: string | null;
  website_url?: string | null;
  logo_url?: string | null;
  lifecycle_status?: string | null;
  lifecycle_note?: string | null;
};

export type UpdateEventSeriesInput = {
  name?: string;
  slug?: string;
  description?: string | null;
  website_url?: string | null;
  logo_url?: string | null;
  lifecycle_status?: string | null;
  lifecycle_note?: string | null;
};

export type EventSeriesListItem = EventSeriesRow & {
  edition_count: number;
};

export async function listEventSeriesAdmin(search?: string): Promise<EventSeriesListItem[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("event_series")
    .select("id, name, slug, description, website_url, logo_url, lifecycle_status, lifecycle_note, created_at")
    .order("name", { ascending: true });

  const term = search?.trim() ?? "";
  if (term !== "") {
    query = query.or(`name.ilike.%${term}%,slug.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const series = (data ?? []) as EventSeriesRow[];
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
    .select("id, name, slug, description, website_url, logo_url, lifecycle_status, lifecycle_note, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as EventSeriesRow | null;
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
  };

  const { data, error } = await supabase
    .from("event_series")
    .insert(payload)
    .select("id, name, slug, description, website_url, logo_url, lifecycle_status, lifecycle_note, created_at")
    .single();

  if (error) throw new Error(error.message);
  return data as EventSeriesRow;
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

  const { data, error } = await supabase
    .from("event_series")
    .update(patch)
    .eq("id", id)
    .select("id, name, slug, description, website_url, logo_url, lifecycle_status, lifecycle_note, created_at")
    .single();

  if (error) throw new Error(error.message);
  return data as EventSeriesRow;
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
    .select("id, name, slug, description, website_url, logo_url, lifecycle_status, lifecycle_note, created_at")
    .single();

  if (error) {
    return { ok: false, status: 500, error: error.message };
  }

  scheduleEventSeriesLogoCleanupAfterPersist({
    seriesId,
    publicUrl: upload.publicUrl,
  });

  return { ok: true, series: data as EventSeriesRow };
}
