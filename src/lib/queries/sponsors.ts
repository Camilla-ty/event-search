import { createClient } from "@/src/lib/supabase/server";
import { getCompaniesByEventEdition } from "@/src/lib/queries/companies";
import { EVENT_EDITION_LIST_SELECT } from "@/src/lib/queries/events";

const EVENT_SPONSOR_WITH_EDITION_SELECT = `
  id,
  tier_rank,
  event_editions (
    ${EVENT_EDITION_LIST_SELECT}
  )
`;

/**
 * Sponsor rows for a company (`event_sponsors.company_id`), each with its event edition.
 */
export async function getSponsorLinksWithEditionsForCompany(companyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_sponsors")
    .select(EVENT_SPONSOR_WITH_EDITION_SELECT)
    .eq("company_id", companyId);

  if (error) throw new Error(error.message);
  return data;
}

/** Sponsors for an event edition — same resolver as edition detail (`company_id` + batch companies). */
export async function getSponsorsByEventEdition(eventEditionId: string) {
  return getCompaniesByEventEdition(eventEditionId);
}
