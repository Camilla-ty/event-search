import { EVENT_EDITION_LIST_SELECT } from "@/src/lib/queries/events";
import { createClient } from "@/src/lib/supabase/server";

const EVENT_EXHIBITOR_WITH_EDITION_SELECT = `
  id,
  tier_rank,
  tier_label,
  event_editions (
    ${EVENT_EDITION_LIST_SELECT}
  )
`;

/**
 * Exhibitor rows for a company (`event_exhibitors.company_id`), each with its event edition.
 * Uses the session client + public RLS (full SELECT for anon and authenticated).
 */
export async function getExhibitorLinksWithEditionsForCompany(companyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_exhibitors")
    .select(EVENT_EXHIBITOR_WITH_EDITION_SELECT)
    .eq("company_id", companyId);

  if (error) throw new Error(error.message);
  return data;
}
