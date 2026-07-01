import { createAdminClient } from "@/src/lib/supabase/admin";

export type VenueOption = {
  id: string;
  name: string;
  label: string;
};

export async function listVenueOptionsForCityAdmin(cityId: string): Promise<VenueOption[]> {
  const trimmedCityId = cityId.trim();
  if (trimmedCityId === "") return [];

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("venues")
    .select("id, name")
    .eq("city_id", trimmedCityId)
    .is("archived_at", null)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const name = typeof row.name === "string" ? row.name : "";
    const id = typeof row.id === "string" ? row.id : String(row.id);
    return { id, name, label: name };
  });
}
