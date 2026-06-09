import { createAdminClient } from "@/src/lib/supabase/admin";
import { CITY_ADMIN_SELECT } from "@/src/lib/location/cityEmbedSelect";
import {
  formatLocationLabel,
  type LocationLabelInput,
} from "@/src/lib/location/formatLocationLabel";
import { locationInputFromCityEmbed } from "@/src/lib/location/parseLocationEmbed";
import { slugify } from "@/src/lib/slugify";

export type CountryOption = {
  id: string;
  name: string;
};

export type StateOption = {
  id: string;
  name: string;
  country_id: string;
};

export type CityOption = {
  id: string;
  label: string;
  city: string;
  state: string | null;
  country: string | null;
};

export type CreatedCityRow = CityOption;

function rowToCityOption(row: Record<string, unknown>): CityOption {
  const input = locationInputFromCityEmbed(row);
  const id = typeof row.id === "string" ? row.id : String(row.id);
  const city = input.city ?? "";
  return {
    id,
    city,
    state: input.state ?? null,
    country: input.country ?? null,
    label: formatLocationLabel(input),
  };
}

export async function listCountriesAdmin(): Promise<CountryOption[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("countries")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: typeof row.name === "string" ? row.name : "",
  }));
}

export async function listStatesByCountryAdmin(
  countryId: string,
): Promise<StateOption[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("states")
    .select("id, name, country_id")
    .eq("country_id", countryId)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: typeof row.name === "string" ? row.name : "",
    country_id: typeof row.country_id === "string" ? row.country_id : "",
  }));
}

export async function getCityOptionsAdmin(): Promise<CityOption[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("cities")
    .select(CITY_ADMIN_SELECT)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => rowToCityOption(row as Record<string, unknown>));
}

export async function findDuplicateCity(params: {
  name: string;
  countryId: string;
  stateId: string | null;
}): Promise<CityOption | null> {
  const supabase = createAdminClient();
  const normalizedName = params.name.trim();

  let query = supabase
    .from("cities")
    .select(CITY_ADMIN_SELECT)
    .eq("country_id", params.countryId)
    .ilike("name", normalizedName);

  if (params.stateId) {
    query = query.eq("state_id", params.stateId);
  } else {
    query = query.is("state_id", null);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  return rowToCityOption(data as Record<string, unknown>);
}

async function resolveUniqueCitySlug(baseName: string, countryId: string): Promise<string> {
  const supabase = createAdminClient();
  let candidate = slugify(baseName);
  if (candidate === "") candidate = "city";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = attempt === 0 ? candidate : `${candidate}-${attempt + 1}`;
    const { data, error } = await supabase
      .from("cities")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return slug;
  }

  return `${candidate}-${Date.now()}`;
}

export type CreateCityInput = {
  name: string;
  country_id: string;
  state_id?: string | null;
};

export async function createCityAdmin(input: CreateCityInput): Promise<CreatedCityRow> {
  const name = input.name.trim();
  const countryId = input.country_id.trim();
  const stateId =
    input.state_id === null || input.state_id === undefined || input.state_id === ""
      ? null
      : input.state_id.trim();

  if (!name) throw new Error("City name is required.");

  const states = await listStatesByCountryAdmin(countryId);
  if (states.length > 0 && stateId === null) {
    throw new Error("Select a state for this country.");
  }
  if (stateId !== null) {
    const validState = states.some((state) => state.id === stateId);
    if (!validState) {
      throw new Error("state_id is not valid for the selected country.");
    }
  }

  const duplicate = await findDuplicateCity({
    name,
    countryId,
    stateId,
  });
  if (duplicate) {
    const err = new Error("A city with this name already exists for this location.");
    (err as Error & { code?: string; existingCity?: CityOption }).code = "DUPLICATE_CITY";
    (err as Error & { code?: string; existingCity?: CityOption }).existingCity = duplicate;
    throw err;
  }

  const slug = await resolveUniqueCitySlug(name, countryId);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("cities")
    .insert({
      name,
      slug,
      country_id: countryId,
      state_id: stateId,
    })
    .select(CITY_ADMIN_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return rowToCityOption(data as Record<string, unknown>);
}

export function cityOptionFromParts(input: LocationLabelInput & { id: string }): CityOption {
  return {
    id: input.id,
    city: input.city ?? "",
    state: input.state ?? null,
    country: input.country ?? null,
    label: formatLocationLabel(input),
  };
}
