import { getCompanyAdminById } from "@/src/features/companies/server/companyAdmin";
import {
  computeMoveOrderedLinkIds,
  validateTierReorderLinkIds,
} from "@/src/features/events/server/eventSponsorReorder";
import { assertCompanyLinkable } from "@/src/lib/companies/assertCompanyLinkable";
import { createAdminClient } from "@/src/lib/supabase/admin";
import type {
  EventExhibitorCreatePayload,
  EventExhibitorTierReorderPayload,
  EventExhibitorUpdatePatch,
  ExhibitorMoveDirection,
} from "@/src/lib/validation/eventExhibitor";

export const DUPLICATE_EXHIBITOR_LINK_MESSAGE =
  "This company is already an exhibitor of this event.";

const UNIQUE_VIOLATION_CODE = "23505";

const EVENT_EXHIBITOR_LINK_SELECT =
  "id, event_editions_id, company_id, tier_rank, tier_label, display_order";

export type EventExhibitorLinkAdminRow = {
  id: string;
  event_editions_id: string;
  company_id: string;
  tier_rank: number | null;
  tier_label: string | null;
  display_order: number | null;
};

export type LiveExhibitorRow = {
  id: string;
  tier_rank: number | null;
  tier_label: string | null;
  display_order: number | null;
  company_id: string;
  companies: {
    id: string;
    name: string | null;
    slug: string | null;
    domain: string | null;
  } | null;
};

function toLinkRow(raw: Record<string, unknown>): EventExhibitorLinkAdminRow {
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

function companyIdKey(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  return String(raw).trim().toLowerCase();
}

async function nextDisplayOrderForTier(
  supabase: AdminClient,
  editionId: string,
  tierRank: number | null,
): Promise<number> {
  let query = supabase
    .from("event_exhibitors")
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

export async function getEventExhibitorLinkAdminById(
  linkId: string,
): Promise<EventExhibitorLinkAdminRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("event_exhibitors")
    .select(EVENT_EXHIBITOR_LINK_SELECT)
    .eq("id", linkId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? toLinkRow(data as Record<string, unknown>) : null;
}

export async function countLiveExhibitorsForEdition(editionId: string): Promise<number> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("event_exhibitors")
    .select("id", { count: "exact", head: true })
    .eq("event_editions_id", editionId);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Live exhibitor roster for admin — company name/slug/domain only (no logo drawer). */
export async function getLiveExhibitorsForEditionAdmin(
  eventEditionId: string,
): Promise<LiveExhibitorRow[]> {
  const supabase = createAdminClient();
  const editionKey = eventEditionId.trim();

  const { data: links, error } = await supabase
    .from("event_exhibitors")
    .select("id, company_id, tier_rank, tier_label, display_order")
    .eq("event_editions_id", editionKey)
    .order("tier_rank", { ascending: true, nullsFirst: false })
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true });

  if (error) throw new Error(error.message);
  if (!links || links.length === 0) return [];

  const companyIds = [
    ...new Set(
      links
        .map((link) => companyIdKey(link.company_id))
        .filter((id) => id !== ""),
    ),
  ];

  const { data: companyRows, error: companyError } = await supabase
    .from("companies")
    .select("id, name, slug, domain")
    .in("id", companyIds);

  if (companyError) throw new Error(companyError.message);

  const companyById = new Map<
    string,
    { id: string; name: string | null; slug: string | null; domain: string | null }
  >();
  for (const row of companyRows ?? []) {
    companyById.set(companyIdKey(row.id), {
      id: String(row.id),
      name: typeof row.name === "string" ? row.name : null,
      slug: typeof row.slug === "string" ? row.slug : null,
      domain: typeof row.domain === "string" ? row.domain : null,
    });
  }

  return links.map((link) => {
    const companyId = String(link.company_id);
    return {
      id: String(link.id),
      company_id: companyId,
      tier_rank: typeof link.tier_rank === "number" ? link.tier_rank : null,
      tier_label: typeof link.tier_label === "string" ? link.tier_label : null,
      display_order: typeof link.display_order === "number" ? link.display_order : null,
      companies: companyById.get(companyIdKey(companyId)) ?? null,
    };
  });
}

export async function updateEventExhibitorLinkAdmin(
  linkId: string,
  patch: EventExhibitorUpdatePatch,
): Promise<EventExhibitorLinkAdminRow> {
  const supabase = createAdminClient();
  const current = await getEventExhibitorLinkAdminById(linkId);
  if (!current) throw new Error("Exhibitor link not found.");

  const writePatch: EventExhibitorUpdatePatch & { display_order?: number; updated_at?: string } = {
    ...patch,
    updated_at: new Date().toISOString(),
  };

  if (patch.tier_rank !== undefined && current.tier_rank !== patch.tier_rank) {
    writePatch.display_order = await nextDisplayOrderForTier(
      supabase,
      current.event_editions_id,
      patch.tier_rank,
    );
  }

  const { data, error } = await supabase
    .from("event_exhibitors")
    .update(writePatch)
    .eq("id", linkId)
    .select(EVENT_EXHIBITOR_LINK_SELECT)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Exhibitor link not found.");

  return toLinkRow(data as Record<string, unknown>);
}

export async function createEventExhibitorLinkAdmin(
  editionId: string,
  payload: EventExhibitorCreatePayload,
): Promise<EventExhibitorLinkAdminRow> {
  const company = await getCompanyAdminById(payload.company_id);
  assertCompanyLinkable(company);

  const supabase = createAdminClient();
  const displayOrder = await nextDisplayOrderForTier(
    supabase,
    editionId,
    payload.tier_rank,
  );
  const { data, error } = await supabase
    .from("event_exhibitors")
    .insert({
      event_editions_id: editionId,
      company_id: payload.company_id,
      tier_rank: payload.tier_rank,
      tier_label: payload.tier_label,
      display_order: displayOrder,
    })
    .select(EVENT_EXHIBITOR_LINK_SELECT)
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION_CODE) {
      throw new Error(DUPLICATE_EXHIBITOR_LINK_MESSAGE);
    }
    throw new Error(error.message);
  }
  return toLinkRow(data as Record<string, unknown>);
}

async function loadEventExhibitorTierSiblings(
  supabase: AdminClient,
  editionId: string,
  tierRank: number | null,
): Promise<EventExhibitorLinkAdminRow[]> {
  let siblingsQuery = supabase
    .from("event_exhibitors")
    .select(EVENT_EXHIBITOR_LINK_SELECT)
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

export async function reorderEventExhibitorLinksInTierAdmin(
  editionId: string,
  payload: EventExhibitorTierReorderPayload,
): Promise<EventExhibitorLinkAdminRow[]> {
  const supabase = createAdminClient();
  const siblings = await loadEventExhibitorTierSiblings(
    supabase,
    editionId,
    payload.tier_rank,
  );

  const validation = validateTierReorderLinkIds(
    payload.ordered_link_ids,
    siblings.map((row) => row.id),
    "exhibitor",
  );
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const siblingsById = new Map(siblings.map((row) => [row.id, row]));
  const updatedRows: EventExhibitorLinkAdminRow[] = [];
  const now = new Date().toISOString();

  for (let position = 0; position < payload.ordered_link_ids.length; position += 1) {
    const linkId = payload.ordered_link_ids[position];
    if (linkId === undefined) {
      throw new Error("Exhibitor ordering is out of sync. Reload and try again.");
    }

    const row = siblingsById.get(linkId);
    if (row === undefined) {
      throw new Error("Exhibitor ordering is out of sync. Reload and try again.");
    }

    const desiredOrder = position + 1;
    if (row.display_order === desiredOrder) {
      updatedRows.push(row);
      continue;
    }

    const { data: updated, error: updateError } = await supabase
      .from("event_exhibitors")
      .update({ display_order: desiredOrder, updated_at: now })
      .eq("id", row.id)
      .select(EVENT_EXHIBITOR_LINK_SELECT)
      .maybeSingle();

    if (updateError) throw new Error(updateError.message);
    if (!updated) {
      throw new Error("Exhibitor link not found.");
    }

    updatedRows.push(toLinkRow(updated as Record<string, unknown>));
  }

  return updatedRows;
}

/** One-step ↑/↓ within the same tier; boundary is a successful no-op. */
export async function moveEventExhibitorLinkAdmin(
  linkId: string,
  direction: ExhibitorMoveDirection,
): Promise<EventExhibitorLinkAdminRow | null> {
  const link = await getEventExhibitorLinkAdminById(linkId);
  if (!link) return null;

  const supabase = createAdminClient();
  const siblings = await loadEventExhibitorTierSiblings(
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

  const updatedRows = await reorderEventExhibitorLinksInTierAdmin(link.event_editions_id, {
    tier_rank: link.tier_rank,
    ordered_link_ids: [...nextOrder],
  });

  return updatedRows.find((row) => row.id === linkId) ?? link;
}

export async function deleteEventExhibitorLinkAdmin(
  linkId: string,
): Promise<EventExhibitorLinkAdminRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("event_exhibitors")
    .delete()
    .eq("id", linkId)
    .select(EVENT_EXHIBITOR_LINK_SELECT)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? toLinkRow(data as Record<string, unknown>) : null;
}
