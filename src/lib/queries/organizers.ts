import { createClient } from "@/src/lib/supabase/server";

export async function getOrganizersByEventEdition(eventEditionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_organizers")
    .select(
      `
      *,
      organizers (*)
    `,
    )
    .eq("event_editions_id", eventEditionId);

  if (error) throw new Error(error.message);
  return data;
}
