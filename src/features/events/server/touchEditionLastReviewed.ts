import { createAdminClient } from "@/src/lib/supabase/admin";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertEditionId(editionId: string): void {
  const trimmed = editionId.trim();
  if (!UUID_REGEX.test(trimmed)) {
    throw new Error("Edition id must be a valid UUID.");
  }
}

/** Sets `event_editions.last_reviewed_at` to the current server time. */
export async function touchEditionLastReviewed(editionId: string): Promise<void> {
  assertEditionId(editionId);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("event_editions")
    .update({ last_reviewed_at: new Date().toISOString() })
    .eq("id", editionId.trim())
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Edition not found.");
}
