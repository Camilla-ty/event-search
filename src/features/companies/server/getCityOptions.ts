import { createAdminClient } from "@/src/lib/supabase/admin";

export type CityOption = {
  id: string;
  label: string;
};

export async function getCityOptions() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("cities")
    .select(
      `
      id,
      name,
      countries (
        name
      )
    `,
    )
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  return rows.map((city) => {
    const countries = city.countries;
    const countryName =
      Array.isArray(countries) && countries.length > 0
        ? countries[0]?.name
        : null;
    return {
      id: String(city.id),
      label: countryName ? `${city.name}, ${countryName}` : city.name,
    } satisfies CityOption;
  });
}
