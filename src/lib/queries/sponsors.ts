import { createClient } from "@/src/lib/supabase/server";
import { getCompaniesByEventEdition } from "@/src/lib/queries/companies";
import { EVENT_EDITION_LIST_SELECT } from "@/src/lib/queries/events";

const EVENT_SPONSOR_WITH_EDITION_SELECT = `
  id,
  tier_rank,
  tier_label,
  event_editions (
    ${EVENT_EDITION_LIST_SELECT}
  )
`;

export type CompanySponsorStatsRow = {
  sponsored_edition_count: number;
  latest_activity_at: string | null;
};

export async function getCompanySponsorStats(
  companyId: string,
): Promise<CompanySponsorStatsRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_sponsor_stats")
    .select("sponsored_edition_count, latest_activity_at")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (data === null) return null;

  const countRaw = data.sponsored_edition_count;
  const sponsored_edition_count =
    typeof countRaw === "number" && Number.isFinite(countRaw)
      ? Math.max(0, Math.trunc(countRaw))
      : 0;
  const latest_activity_at =
    typeof data.latest_activity_at === "string" ? data.latest_activity_at : null;

  return { sponsored_edition_count, latest_activity_at };
}

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
