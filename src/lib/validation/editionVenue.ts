import { createAdminClient } from "@/src/lib/supabase/admin";
import { parseOptionalUuid } from "@/src/lib/validation/eventEdition";

export type EditionVenueValidationInput = {
  venueId: string | null;
  cityId: string | null;
  previousVenueId?: string | null;
};

export function parseEditionVenueId(raw: unknown): string | null {
  return parseOptionalUuid(raw);
}

export function validateEditionVenueFieldsSync(input: EditionVenueValidationInput): string[] {
  const errors: string[] = [];

  if (input.venueId && !input.cityId) {
    errors.push("city_id is required when venue_id is set");
  }

  return errors;
}

export async function validateEditionVenueAttachment(
  input: EditionVenueValidationInput,
): Promise<string[]> {
  const syncErrors = validateEditionVenueFieldsSync(input);
  if (syncErrors.length > 0) return syncErrors;

  if (!input.venueId) return [];

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("venues")
    .select("id, city_id, archived_at")
    .eq("id", input.venueId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    return ["venue_id does not reference an existing venue"];
  }

  const venueCityId =
    typeof data.city_id === "string" ? data.city_id : String(data.city_id ?? "");
  const editionCityId = input.cityId?.trim() ?? "";

  if (editionCityId === "") {
    return ["city_id is required when venue_id is set"];
  }

  if (editionCityId !== venueCityId) {
    return ["event edition city_id must match the selected venue city"];
  }

  const isArchived = data.archived_at !== null;
  const previousVenueId = input.previousVenueId?.trim() || null;
  const isNewAttachment = previousVenueId !== input.venueId;

  if (isArchived && isNewAttachment) {
    return ["cannot attach an archived venue to an event edition"];
  }

  return [];
}
