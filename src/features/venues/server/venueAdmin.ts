import { createAdminClient } from "@/src/lib/supabase/admin";
import { validateCompanyLogoUpload } from "@/src/lib/companies/companyLogoUploadValidation";
import { CITY_ADMIN_SELECT } from "@/src/lib/location/cityEmbedSelect";
import {
  formatLocationLabel,
  type LocationLabelInput,
} from "@/src/lib/location/formatLocationLabel";
import { locationInputFromCityEmbed } from "@/src/lib/location/parseLocationEmbed";
import { slugify } from "@/src/lib/slugify";

import {
  duplicateVenueNameWarning,
  parseCreateVenueFields,
  parseUpdateVenueFields,
  VENUE_CITY_IMMUTABLE_WHEN_LINKED_MESSAGE,
} from "./venueAdminValidation";
import {
  scheduleVenueLogoCleanupAfterPersist,
  uploadVenueLogoBytes,
  verifyVenueLogoStorageObject,
} from "./venueLogoStorage";

export class VenueAdminError extends Error {
  readonly status: 400 | 404 | 409;

  constructor(message: string, status: 400 | 404 | 409 = 400) {
    super(message);
    this.name = "VenueAdminError";
    this.status = status;
  }
}

export type VenueRow = {
  id: string;
  name: string;
  slug: string;
  city_id: string;
  website_url: string | null;
  address_text: string | null;
  logo_url: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type VenueAdminDetail = VenueRow & {
  city_label: string;
  linked_edition_count: number;
};

export type VenueListItem = VenueRow & {
  city_label: string;
  linked_edition_count: number;
};

const VENUE_SELECT = `
  id,
  name,
  slug,
  city_id,
  website_url,
  address_text,
  logo_url,
  archived_at,
  created_at,
  updated_at
`;

function cityLabelFromEmbed(row: Record<string, unknown>): string {
  const input: LocationLabelInput = locationInputFromCityEmbed(row);
  return formatLocationLabel(input);
}

async function loadCityLabelsById(
  cityIds: string[],
): Promise<Map<string, string>> {
  if (cityIds.length === 0) return new Map();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("cities")
    .select(CITY_ADMIN_SELECT)
    .in("id", cityIds);

  if (error) throw new Error(error.message);

  const labels = new Map<string, string>();
  for (const row of data ?? []) {
    const record = row as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : String(record.id);
    labels.set(id, cityLabelFromEmbed(record));
  }
  return labels;
}

async function countLinkedEditionsByVenueIds(
  venueIds: string[],
): Promise<Map<string, number>> {
  if (venueIds.length === 0) return new Map();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("event_editions")
    .select("venue_id")
    .in("venue_id", venueIds);

  if (error) throw new Error(error.message);

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const venueId = row.venue_id;
    if (typeof venueId === "string" && venueId !== "") {
      counts.set(venueId, (counts.get(venueId) ?? 0) + 1);
    }
  }
  return counts;
}

async function countLinkedEditions(venueId: string): Promise<number> {
  const counts = await countLinkedEditionsByVenueIds([venueId]);
  return counts.get(venueId) ?? 0;
}

function mapVenueRow(row: Record<string, unknown>): VenueRow {
  return {
    id: String(row.id),
    name: typeof row.name === "string" ? row.name : "",
    slug: typeof row.slug === "string" ? row.slug : "",
    city_id: typeof row.city_id === "string" ? row.city_id : String(row.city_id),
    website_url: typeof row.website_url === "string" ? row.website_url : null,
    address_text: typeof row.address_text === "string" ? row.address_text : null,
    logo_url: typeof row.logo_url === "string" ? row.logo_url : null,
    archived_at: typeof row.archived_at === "string" ? row.archived_at : null,
    created_at: typeof row.created_at === "string" ? row.created_at : "",
    updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
  };
}

async function enrichVenueListItems(rows: VenueRow[]): Promise<VenueListItem[]> {
  const cityIds = [...new Set(rows.map((row) => row.city_id))];
  const venueIds = rows.map((row) => row.id);
  const [cityLabels, editionCounts] = await Promise.all([
    loadCityLabelsById(cityIds),
    countLinkedEditionsByVenueIds(venueIds),
  ]);

  return rows.map((row) => ({
    ...row,
    city_label: cityLabels.get(row.city_id) ?? row.city_id,
    linked_edition_count: editionCounts.get(row.id) ?? 0,
  }));
}

export async function resolveUniqueVenueSlug(baseSlug: string): Promise<string> {
  const supabase = createAdminClient();
  let candidate = slugify(baseSlug);
  if (candidate === "") candidate = "venue";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = attempt === 0 ? candidate : `${candidate}-${attempt + 1}`;
    const { data, error } = await supabase
      .from("venues")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return slug;
  }

  return `${candidate}-${Date.now()}`;
}

async function findDuplicateVenueNamesInCity(params: {
  name: string;
  cityId: string;
  excludeVenueId?: string;
}): Promise<string[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("venues")
    .select("name")
    .eq("city_id", params.cityId)
    .ilike("name", params.name.trim());

  if (params.excludeVenueId) {
    query = query.neq("id", params.excludeVenueId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row) => (typeof row.name === "string" ? row.name : ""))
    .filter((name) => name !== "");
}

async function assertCityExists(cityId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("cities").select("id").eq("id", cityId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new VenueAdminError("city_id does not reference an existing city.", 400);
}

export type ListVenuesAdminParams = {
  search?: string;
  includeArchived?: boolean;
};

export async function listVenuesAdmin(
  params: ListVenuesAdminParams = {},
): Promise<VenueListItem[]> {
  const supabase = createAdminClient();
  let query = supabase.from("venues").select(VENUE_SELECT).order("name", { ascending: true });

  if (!params.includeArchived) {
    query = query.is("archived_at", null);
  }

  const term = params.search?.trim() ?? "";
  if (term !== "") {
    const { data: cityRows, error: cityError } = await supabase
      .from("cities")
      .select("id")
      .ilike("name", `%${term}%`);

    if (cityError) throw new Error(cityError.message);

    const cityIds = (cityRows ?? [])
      .map((row) => (typeof row.id === "string" ? row.id : ""))
      .filter((id) => id !== "");

    const filters = [`name.ilike.%${term}%`, `slug.ilike.%${term}%`];
    if (cityIds.length > 0) {
      filters.push(`city_id.in.(${cityIds.join(",")})`);
    }
    query = query.or(filters.join(","));
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((row) => mapVenueRow(row as Record<string, unknown>));
  return enrichVenueListItems(rows);
}

export async function getVenueAdminById(id: string): Promise<VenueAdminDetail | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("venues")
    .select(VENUE_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const venue = mapVenueRow(data as Record<string, unknown>);
  const [cityLabels, linkedEditionCount] = await Promise.all([
    loadCityLabelsById([venue.city_id]),
    countLinkedEditions(venue.id),
  ]);

  return {
    ...venue,
    city_label: cityLabels.get(venue.city_id) ?? venue.city_id,
    linked_edition_count: linkedEditionCount,
  };
}

export type CreateVenueAdminInput = {
  name: string;
  slug: string;
  city_id: string;
  website_url?: string | null;
  address_text?: string | null;
  logo_url?: string | null;
};

export type VenueMutationResult = {
  venue: VenueAdminDetail;
  warnings: string[];
};

export async function createVenueAdmin(
  input: CreateVenueAdminInput,
): Promise<VenueMutationResult> {
  const parsed = parseCreateVenueFields(input);
  if (parsed.errors.length > 0) {
    throw new VenueAdminError(parsed.errors.join("; "), 400);
  }

  const fields = parsed.fields;
  if (!fields.name || !fields.slug || !fields.city_id) {
    throw new VenueAdminError("Invalid venue fields.", 400);
  }

  await assertCityExists(fields.city_id);

  const slug = await resolveUniqueVenueSlug(fields.slug);
  const now = new Date().toISOString();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("venues")
    .insert({
      name: fields.name,
      slug,
      city_id: fields.city_id,
      website_url: fields.website_url ?? null,
      address_text: fields.address_text ?? null,
      logo_url: fields.logo_url ?? null,
      updated_at: now,
    })
    .select(VENUE_SELECT)
    .single();

  if (error) throw new Error(error.message);

  const venue = mapVenueRow(data as Record<string, unknown>);
  const [cityLabels, duplicateNames] = await Promise.all([
    loadCityLabelsById([venue.city_id]),
    findDuplicateVenueNamesInCity({
      name: venue.name,
      cityId: venue.city_id,
      excludeVenueId: venue.id,
    }),
  ]);

  const warnings: string[] = [];
  const duplicateWarning = duplicateVenueNameWarning(venue.name, duplicateNames);
  if (duplicateWarning) warnings.push(duplicateWarning);

  return {
    venue: {
      ...venue,
      city_label: cityLabels.get(venue.city_id) ?? venue.city_id,
      linked_edition_count: 0,
    },
    warnings,
  };
}

export type UpdateVenueAdminInput = {
  name?: string;
  slug?: string;
  city_id?: string;
  website_url?: string | null;
  address_text?: string | null;
  logo_url?: string | null;
  archived_at?: unknown;
};

export async function updateVenueAdmin(
  id: string,
  input: UpdateVenueAdminInput,
): Promise<VenueMutationResult> {
  const existing = await getVenueAdminById(id);
  if (!existing) {
    throw new VenueAdminError("Venue not found.", 404);
  }

  const parsed = parseUpdateVenueFields(input);
  if (parsed.errors.length > 0) {
    throw new VenueAdminError(parsed.errors.join("; "), 400);
  }

  const fields = parsed.fields;
  if (Object.keys(fields).length === 0) {
    throw new VenueAdminError("No fields to update.", 400);
  }

  if (fields.city_id !== undefined && fields.city_id !== existing.city_id) {
    if (existing.linked_edition_count > 0) {
      throw new VenueAdminError(VENUE_CITY_IMMUTABLE_WHEN_LINKED_MESSAGE, 409);
    }
    await assertCityExists(fields.city_id);
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.name !== undefined) patch.name = fields.name;
  if (fields.slug !== undefined) patch.slug = fields.slug;
  if (fields.city_id !== undefined) patch.city_id = fields.city_id;
  if (fields.website_url !== undefined) patch.website_url = fields.website_url;
  if (fields.address_text !== undefined) patch.address_text = fields.address_text;
  if (fields.logo_url !== undefined) patch.logo_url = fields.logo_url;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("venues")
    .update(patch)
    .eq("id", id)
    .select(VENUE_SELECT)
    .single();

  if (error) throw new Error(error.message);

  const venue = mapVenueRow(data as Record<string, unknown>);
  const [cityLabels, linkedEditionCount, duplicateNames] = await Promise.all([
    loadCityLabelsById([venue.city_id]),
    countLinkedEditions(venue.id),
    findDuplicateVenueNamesInCity({
      name: venue.name,
      cityId: venue.city_id,
      excludeVenueId: venue.id,
    }),
  ]);

  const warnings: string[] = [];
  const duplicateWarning = duplicateVenueNameWarning(venue.name, duplicateNames);
  if (duplicateWarning) warnings.push(duplicateWarning);

  return {
    venue: {
      ...venue,
      city_label: cityLabels.get(venue.city_id) ?? venue.city_id,
      linked_edition_count: linkedEditionCount,
    },
    warnings,
  };
}

export async function archiveVenueAdmin(id: string): Promise<VenueMutationResult> {
  const existing = await getVenueAdminById(id);
  if (!existing) {
    throw new VenueAdminError("Venue not found.", 404);
  }

  if (existing.archived_at !== null) {
    return { venue: existing, warnings: [] };
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("venues")
    .update({ archived_at: now, updated_at: now })
    .eq("id", id)
    .select(VENUE_SELECT)
    .single();

  if (error) throw new Error(error.message);

  const venue = mapVenueRow(data as Record<string, unknown>);
  const cityLabels = await loadCityLabelsById([venue.city_id]);

  return {
    venue: {
      ...venue,
      city_label: cityLabels.get(venue.city_id) ?? venue.city_id,
      linked_edition_count: existing.linked_edition_count,
    },
    warnings: [],
  };
}

export async function unarchiveVenueAdmin(id: string): Promise<VenueMutationResult> {
  const existing = await getVenueAdminById(id);
  if (!existing) {
    throw new VenueAdminError("Venue not found.", 404);
  }

  if (existing.archived_at === null) {
    return { venue: existing, warnings: [] };
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("venues")
    .update({ archived_at: null, updated_at: now })
    .eq("id", id)
    .select(VENUE_SELECT)
    .single();

  if (error) throw new Error(error.message);

  const venue = mapVenueRow(data as Record<string, unknown>);
  const cityLabels = await loadCityLabelsById([venue.city_id]);

  return {
    venue: {
      ...venue,
      city_label: cityLabels.get(venue.city_id) ?? venue.city_id,
      linked_edition_count: existing.linked_edition_count,
    },
    warnings: [],
  };
}

export function defaultVenueSlug(name: string): string {
  return slugify(name);
}

export type VenueLinkedEditionRow = {
  id: string;
  name: string;
  year: number;
  slug: string;
};

export async function listLinkedEditionsForVenueAdmin(
  venueId: string,
): Promise<VenueLinkedEditionRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("event_editions")
    .select("id, name, year, slug")
    .eq("venue_id", venueId)
    .order("year", { ascending: false })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: typeof row.name === "string" ? row.name : "",
    year: typeof row.year === "number" ? row.year : Number(row.year),
    slug: typeof row.slug === "string" ? row.slug : "",
  }));
}

export type UploadVenueLogoFileInput = {
  bytes: Uint8Array;
  mimeType: string;
};

export type UploadVenueLogoFileAdminResult =
  | { ok: true; venue: VenueAdminDetail }
  | { ok: false; status: 400 | 404 | 500; error: string };

export async function uploadVenueLogoFileAdmin(
  venueId: string,
  input: UploadVenueLogoFileInput,
): Promise<UploadVenueLogoFileAdminResult> {
  const existing = await getVenueAdminById(venueId);
  if (!existing) {
    return { ok: false, status: 404, error: "Venue not found." };
  }

  const validation = validateCompanyLogoUpload({
    bytes: input.bytes,
    mimeType: input.mimeType,
  });
  if (!validation.ok) {
    return { ok: false, status: 400, error: validation.message };
  }

  const upload = await uploadVenueLogoBytes({
    venueId,
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

  const verified = await verifyVenueLogoStorageObject(upload.storagePath);
  if (!verified.ok) {
    return { ok: false, status: 500, error: "Uploaded logo could not be verified." };
  }

  const now = new Date().toISOString();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("venues")
    .update({ logo_url: upload.publicUrl, updated_at: now })
    .eq("id", venueId)
    .select(VENUE_SELECT)
    .single();

  if (error) {
    return { ok: false, status: 500, error: error.message };
  }

  scheduleVenueLogoCleanupAfterPersist({
    venueId,
    publicUrl: upload.publicUrl,
  });

  const venue = mapVenueRow(data as Record<string, unknown>);
  const cityLabels = await loadCityLabelsById([venue.city_id]);

  return {
    ok: true,
    venue: {
      ...venue,
      city_label: cityLabels.get(venue.city_id) ?? venue.city_id,
      linked_edition_count: existing.linked_edition_count,
    },
  };
}
