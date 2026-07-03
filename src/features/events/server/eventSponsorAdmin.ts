import { shouldAutoTouchSponsorUpdate } from "@/src/features/events/server/editionLastReviewedPolicy";
import { touchEditionLastReviewed } from "@/src/features/events/server/touchEditionLastReviewed";
import { createAdminClient } from "@/src/lib/supabase/admin";

import type {
  EventSponsorCreatePayload,
  EventSponsorTierReorderPayload,
  EventSponsorUpdatePatch,
  SponsorMoveDirection,
} from "@/src/lib/validation/eventSponsor";

import {
  computeMoveOrderedLinkIds,
  validateTierReorderLinkIds,
} from "./eventSponsorReorder";

export const DUPLICATE_SPONSOR_LINK_MESSAGE =
  "This company is already a sponsor of this edition.";

const UNIQUE_VIOLATION_CODE = "23505";

const EVENT_SPONSOR_LINK_SELECT =
  "id, event_editions_id, company_id, tier_rank, tier_label, display_order";

export type EventSponsorLinkAdminRow = {
  id: string;
  event_editions_id: string;
  company_id: string;
  tier_rank: number | null;
  tier_label: string | null;
  display_order: number | null;
};

function toLinkRow(raw: Record<string, unknown>): EventSponsorLinkAdminRow {
  return {
    id: String(raw.id),
    event_editions_id: String(raw.event_editions_id),
    company_id: String(raw.company_id),
    tier_rank: typeof raw.tier_rank === "number" ? raw.tier_rank : null,
    tier_label: typeof raw.tier_label === "string" ? raw.tier_label : null,
    display_order: typeof raw.display_order === "number" ? raw.display_order : null,
  };
}

type AdminClient = ReturnType<typeof createAdminClient>;

/** Next append position within an (edition, tier) group. */
async function nextDisplayOrderForTier(
  supabase: AdminClient,
  editionId: string,
  tierRank: number | null,
): Promise<number> {
  let query = supabase
    .from("event_sponsors")
    .select("display_order")
    .eq("event_editions_id", editionId)
    .order("display_order", { ascending: false, nullsFirst: false })
    .limit(1);
  query = tierRank === null ? query.is("tier_rank", null) : query.eq("tier_rank", tierRank);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const first = (data ?? [])[0];
  const max =
    first && typeof first.display_order === "number" ? first.display_order : 0;
  return max + 1;
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
  const current = await getEventSponsorLinkAdminById(linkId);
  if (!current) throw new Error("Sponsor link not found.");

  const writePatch: EventSponsorUpdatePatch & { display_order?: number } = {
    ...patch,
  };

  // A tier change moves the sponsor to the end of its new tier so it lands in
  // a predictable position without colliding with existing orders.
  if (patch.tier_rank !== undefined && current.tier_rank !== patch.tier_rank) {
    writePatch.display_order = await nextDisplayOrderForTier(
      supabase,
      current.event_editions_id,
      patch.tier_rank,
    );
  }

  const { data, error } = await supabase
    .from("event_sponsors")
    .update(writePatch)
    .eq("id", linkId)
    .select(EVENT_SPONSOR_LINK_SELECT)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sponsor link not found.");

  if (shouldAutoTouchSponsorUpdate(current, patch)) {
    await touchEditionLastReviewed(current.event_editions_id);
  }

  return toLinkRow(data as Record<string, unknown>);
}

export async function createEventSponsorLinkAdmin(
  editionId: string,
  payload: EventSponsorCreatePayload,
): Promise<EventSponsorLinkAdminRow> {
  const supabase = createAdminClient();
  const displayOrder = await nextDisplayOrderForTier(
    supabase,
    editionId,
    payload.tier_rank,
  );
  const { data, error } = await supabase
    .from("event_sponsors")
    .insert({
      event_editions_id: editionId,
      company_id: payload.company_id,
      tier_rank: payload.tier_rank,
      tier_label: payload.tier_label,
      display_order: displayOrder,
    })
    .select(EVENT_SPONSOR_LINK_SELECT)
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION_CODE) {
      throw new Error(DUPLICATE_SPONSOR_LINK_MESSAGE);
    }
    throw new Error(error.message);
  }
  await touchEditionLastReviewed(editionId);
  return toLinkRow(data as Record<string, unknown>);
}

async function loadEventSponsorTierSiblings(
  supabase: AdminClient,
  editionId: string,
  tierRank: number | null,
): Promise<EventSponsorLinkAdminRow[]> {
  let siblingsQuery = supabase
    .from("event_sponsors")
    .select(EVENT_SPONSOR_LINK_SELECT)
    .eq("event_editions_id", editionId)
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true });
  siblingsQuery =
    tierRank === null
      ? siblingsQuery.is("tier_rank", null)
      : siblingsQuery.eq("tier_rank", tierRank);

  const { data, error } = await siblingsQuery;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => toLinkRow(row as Record<string, unknown>));
}

/**
 * Renumbers one (edition, tier) group to match ordered_link_ids. Validates that
 * the payload includes every sibling exactly once. Returns all rows in the tier
 * after reorder (with dense display_order 1..n).
 */
export async function reorderEventSponsorLinksInTierAdmin(
  editionId: string,
  payload: EventSponsorTierReorderPayload,
): Promise<EventSponsorLinkAdminRow[]> {
  const supabase = createAdminClient();
  const siblings = await loadEventSponsorTierSiblings(
    supabase,
    editionId,
    payload.tier_rank,
  );

  const validation = validateTierReorderLinkIds(
    payload.ordered_link_ids,
    siblings.map((row) => row.id),
  );
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const siblingsById = new Map(siblings.map((row) => [row.id, row]));
  const updatedRows: EventSponsorLinkAdminRow[] = [];

  for (let position = 0; position < payload.ordered_link_ids.length; position += 1) {
    const linkId = payload.ordered_link_ids[position];
    if (linkId === undefined) {
      throw new Error("Sponsor ordering is out of sync. Reload and try again.");
    }

    const row = siblingsById.get(linkId);
    if (row === undefined) {
      throw new Error("Sponsor ordering is out of sync. Reload and try again.");
    }

    const desiredOrder = position + 1;
    if (row.display_order === desiredOrder) {
      updatedRows.push(row);
      continue;
    }

    const { data: updated, error: updateError } = await supabase
      .from("event_sponsors")
      .update({ display_order: desiredOrder })
      .eq("id", row.id)
      .select(EVENT_SPONSOR_LINK_SELECT)
      .maybeSingle();

    if (updateError) throw new Error(updateError.message);
    if (!updated) {
      throw new Error("Sponsor link not found.");
    }

    updatedRows.push(toLinkRow(updated as Record<string, unknown>));
  }

  return updatedRows;
}

/**
 * Moves a sponsor link one position up or down within its (edition, tier)
 * group. Renumbers the whole tier densely (1..n) in the same pass, so legacy
 * rows with null or duplicate display_order self-heal on first move.
 * Returns the moved row, or null if the link does not exist. Moving past a
 * tier boundary is a successful no-op.
 */
export async function moveEventSponsorLinkAdmin(
  linkId: string,
  direction: SponsorMoveDirection,
): Promise<EventSponsorLinkAdminRow | null> {
  const link = await getEventSponsorLinkAdminById(linkId);
  if (!link) return null;

  const supabase = createAdminClient();
  const siblings = await loadEventSponsorTierSiblings(
    supabase,
    link.event_editions_id,
    link.tier_rank,
  );

  const orderedLinkIds = siblings.map((row) => row.id);
  const nextOrder = computeMoveOrderedLinkIds(orderedLinkIds, linkId, direction);
  if (nextOrder === null) {
    if (!orderedLinkIds.includes(linkId)) {
      return null;
    }
    return link;
  }

  const updatedRows = await reorderEventSponsorLinksInTierAdmin(link.event_editions_id, {
    tier_rank: link.tier_rank,
    ordered_link_ids: [...nextOrder],
  });

  return updatedRows.find((row) => row.id === linkId) ?? link;
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
  const row = data ? toLinkRow(data as Record<string, unknown>) : null;
  if (row) {
    await touchEditionLastReviewed(row.event_editions_id);
  }
  return row;
}
