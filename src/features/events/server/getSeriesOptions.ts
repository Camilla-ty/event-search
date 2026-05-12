import { createAdminClient } from "@/src/lib/supabase/admin";

export type SeriesOption = {
  id: string;
  name: string;
};

/**
 * Lightweight loader for event series dropdowns. Mirrors the `getCityOptions` pattern.
 */
export async function getSeriesOptions(): Promise<SeriesOption[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("event_series")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  return rows.map((row) => ({
    id: String(row.id),
    name: typeof row.name === "string" ? row.name : String(row.name ?? ""),
  }));
}
