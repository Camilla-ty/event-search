import { createAdminClient } from "@/src/lib/supabase/admin";

import type {
  EventSponsorCreatePayload,
  EventSponsorUpdatePatch,
} from "@/src/lib/validation/eventSponsor";

export const DUPLICATE_SPONSOR_LINK_MESSAGE =
  "This company is already a sponsor of this edition.";

const UNIQUE_VIOLATION_CODE = "23505";

const EVENT_SPONSOR_LINK_SELECT =
  "id, event_editions_id, company_id, tier_rank, tier_label";

export type EventSponsorLinkAdminRow = {
  id: string;
  event_editions_id: string;
  company_id: string;
  tier_rank: number | null;
  tier_label: string | null;
};

function toLinkRow(raw: Record<string, unknown>): EventSponsorLinkAdminRow {
  return {
    id: String(raw.id),
    event_editions_id: String(raw.event_editions_id),
    company_id: String(raw.company_id),
    tier_rank: typeof raw.tier_rank === "number" ? raw.tier_rank : null,
    tier_label: typeof raw.tier_label === "string" ? raw.tier_label : null,
  };
}

export async function getEventSponsorLinkAdminById(
  linkId: string,
): Promise<EventSponsorLinkAdminRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("event_sponsors")
    .select(EVENT_SPONSOR_LINK_SELECT)
    .eq("id", linkId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? toLinkRow(data as Record<string, unknown>) : null;
}

export async function updateEventSponsorLinkAdmin(
  linkId: string,
  patch: EventSponsorUpdatePatch,
): Promise<EventSponsorLinkAdminRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("event_sponsors")
    .update(patch)
    .eq("id", linkId)
    .select(EVENT_SPONSOR_LINK_SELECT)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sponsor link not found.");
  return toLinkRow(data as Record<string, unknown>);
}

export async function createEventSponsorLinkAdmin(
  editionId: string,
  payload: EventSponsorCreatePayload,
): Promise<EventSponsorLinkAdminRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("event_sponsors")
    .insert({
      event_editions_id: editionId,
      company_id: payload.company_id,
      tier_rank: payload.tier_rank,
      tier_label: payload.tier_label,
    })
    .select(EVENT_SPONSOR_LINK_SELECT)
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION_CODE) {
      throw new Error(DUPLICATE_SPONSOR_LINK_MESSAGE);
    }
    throw new Error(error.message);
  }
  return toLinkRow(data as Record<string, unknown>);
}

/** Deletes a live sponsor link. Returns the deleted row, or null if it did not exist. */
export async function deleteEventSponsorLinkAdmin(
  linkId: string,
): Promise<EventSponsorLinkAdminRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("event_sponsors")
    .delete()
    .eq("id", linkId)
    .select(EVENT_SPONSOR_LINK_SELECT)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? toLinkRow(data as Record<string, unknown>) : null;
}
