import { isValidHttpUrl } from "@/src/lib/validation/url";

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value.trim());
}

export const VENUE_CITY_IMMUTABLE_WHEN_LINKED_MESSAGE =
  "city_id cannot be changed while editions are linked to this venue. Create a new venue for a relocation.";

export type VenueFieldErrors = string[];

export type ParsedVenueFields = {
  name?: string;
  slug?: string;
  city_id?: string;
  website_url?: string | null;
  address_text?: string | null;
  logo_url?: string | null;
};

export function validateOptionalHttpUrl(
  value: string | null | undefined,
  field: string,
  errors: VenueFieldErrors,
): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value?.trim() || null;
  if (trimmed !== null && !isValidHttpUrl(trimmed)) {
    errors.push(`${field} must be a valid URL`);
  }
  return trimmed;
}

export function parseCreateVenueFields(input: {
  name?: string;
  slug?: string;
  city_id?: string;
  website_url?: string | null;
  address_text?: string | null;
  logo_url?: string | null;
}): { errors: VenueFieldErrors; fields: ParsedVenueFields } {
  const errors: VenueFieldErrors = [];
  const name = input.name?.trim() ?? "";
  const slug = input.slug?.trim() ?? "";
  const cityId = input.city_id?.trim() ?? "";

  if (!name) errors.push("name is required");
  if (!slug) errors.push("slug is required");
  if (!cityId) errors.push("city_id is required");
  else if (!isUuid(cityId)) errors.push("city_id must be a valid UUID");

  const website_url = validateOptionalHttpUrl(input.website_url, "website_url", errors);
  const logo_url = validateOptionalHttpUrl(input.logo_url, "logo_url", errors);
  const address_text =
    input.address_text === undefined ? null : input.address_text?.trim() || null;

  return {
    errors,
    fields: {
      name,
      slug,
      city_id: cityId,
      website_url,
      address_text,
      logo_url,
    },
  };
}

export function parseUpdateVenueFields(input: {
  name?: string;
  slug?: string;
  city_id?: string;
  website_url?: string | null;
  address_text?: string | null;
  logo_url?: string | null;
  archived_at?: unknown;
}): { errors: VenueFieldErrors; fields: ParsedVenueFields } {
  const errors: VenueFieldErrors = [];
  const fields: ParsedVenueFields = {};

  if (input.archived_at !== undefined) {
    errors.push("archived_at cannot be updated directly; use archive or unarchive routes");
  }

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) errors.push("name cannot be empty");
    else fields.name = name;
  }

  if (input.slug !== undefined) {
    const slug = input.slug.trim();
    if (!slug) errors.push("slug cannot be empty");
    else fields.slug = slug;
  }

  if (input.city_id !== undefined) {
    const cityId = input.city_id.trim();
    if (!cityId) errors.push("city_id cannot be empty");
    else if (!isUuid(cityId)) errors.push("city_id must be a valid UUID");
    else fields.city_id = cityId;
  }

  if (input.website_url !== undefined) {
    fields.website_url = validateOptionalHttpUrl(input.website_url, "website_url", errors);
  }

  if (input.logo_url !== undefined) {
    fields.logo_url = validateOptionalHttpUrl(input.logo_url, "logo_url", errors);
  }

  if (input.address_text !== undefined) {
    fields.address_text = input.address_text?.trim() || null;
  }

  return { errors, fields };
}

export function duplicateVenueNameWarning(
  name: string,
  existingNames: string[],
): string | null {
  const normalized = name.trim().toLowerCase();
  if (normalized === "") return null;

  const hasDuplicate = existingNames.some(
    (existing) => existing.trim().toLowerCase() === normalized,
  );

  if (!hasDuplicate) return null;

  return `Another venue named "${name.trim()}" already exists in this city.`;
}
