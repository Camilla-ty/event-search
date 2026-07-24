import { computeMoveOrderedLinkIds } from "@/src/features/events/server/eventSponsorReorder";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { shouldAutoTouchOrganizerUpdate } from "@/src/lib/validation/eventOrganizer";

import type {
  EventOrganizerCreatePayload,
  EventOrganizerReorderPayload,
  EventOrganizerUpdatePatch,
} from "@/src/lib/validation/eventOrganizer";

export const DUPLICATE_ORGANIZER_LINK_MESSAGE =
  "This company is already an organizer of this event.";

const UNIQUE_VIOLATION_CODE = "23505";

const ORGANIZER_LINK_SELECT =
  "id, event_editions_id, company_id, role_label, display_order, created_at, updated_at";

type EventOrganizerLinkAdminRow = {
  id: string;
  event_editions_id: string;
  company_id: string;
  role_label: string;
  display_order: number;
  created_at: string | null;
  updated_at: string | null;
};

export type EditionOrganizerAdminRow = EventOrganizerLinkAdminRow & {
  companies: {
    id: string;
    name: string;
    slug: string | null;
    domain: string | null;
    logo_url: string | null;
  } | null;
};

function toLinkRow(raw: Record<string, unknown>): EventOrganizerLinkAdminRow {
  return {
    id: String(raw.id),
    event_editions_id: String(raw.event_editions_id),
    company_id: String(raw.company_id),
    role_label: typeof raw.role_label === "string" ? raw.role_label : "Organizer",
    display_order: typeof raw.display_order === "number" ? raw.display_order : 0,
    created_at: typeof raw.created_at === "string" ? raw.created_at : null,
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : null,
  };
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function nextDisplayOrderForEdition(
  supabase: AdminClient,
  editionId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("event_edition_organizers")
    .select("display_order")
    .eq("event_editions_id", editionId)
    .order("display_order", { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);

  const first = (data ?? [])[0];
  const max =
    first && typeof first.display_order === "number" ? first.display_order : 0;
  return max + 1;
}

async function loadOrganizerSiblings(
  supabase: AdminClient,
  editionId: string,
): Promise<EventOrganizerLinkAdminRow[]> {
  const { data, error } = await supabase
    .from("event_edition_organizers")
    .select(ORGANIZER_LINK_SELECT)
    .eq("event_editions_id", editionId)
    .order("display_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => toLinkRow(row as Record<string, unknown>));
}

async function renumberOrganizerDisplayOrder(
  supabase: AdminClient,
  editionId: string,
  orderedLinkIds: readonly string[],
): Promise<EventOrganizerLinkAdminRow[]> {
  const siblings = await loadOrganizerSiblings(supabase, editionId);
  const siblingsById = new Map(siblings.map((row) => [row.id, row]));
  const nowIso = new Date().toISOString();
  const updatedRows: EventOrganizerLinkAdminRow[] = [];

  for (let position = 0; position < orderedLinkIds.length; position += 1) {
    const linkId = orderedLinkIds[position];
    if (linkId === undefined) {
      throw new Error("Organizer ordering is out of sync. Reload and try again.");
    }

    const row = siblingsById.get(linkId);
    if (row === undefined) {
      throw new Error("Organizer ordering is out of sync. Reload and try again.");
    }

    const desiredOrder = position + 1;
    if (row.display_order === desiredOrder) {
      updatedRows.push(row);
      continue;
    }

    const { data: updated, error } = await supabase
      .from("event_edition_organizers")
      .update({ display_order: desiredOrder, updated_at: nowIso })
      .eq("id", row.id)
      .select(ORGANIZER_LINK_SELECT)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!updated) {
      throw new Error("Organizer link not found.");
    }

    updatedRows.push(toLinkRow(updated as Record<string, unknown>));
  }

  return updatedRows;
}

export async function getOrganizersForEditionAdmin(
  editionId: string,
): Promise<EditionOrganizerAdminRow[]> {
  const supabase = createAdminClient();
  const { data: links, error } = await supabase
    .from("event_edition_organizers")
    .select(ORGANIZER_LINK_SELECT)
    .eq("event_editions_id", editionId)
    .order("display_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw new Error(error.message);
  if (!links || links.length === 0) {
    return [];
  }

  const companyIds = [
    ...new Set(
      links
        .map((link) => String(link.company_id ?? "").trim().toLowerCase())
        .filter((id) => id !== ""),
    ),
  ];

  const { data: companies, error: companiesError } = await supabase
    .from("companies")
    .select("id, name, slug, domain, logo_url")
    .in("id", companyIds);

  if (companiesError) throw new Error(companiesError.message);

  const companyById = new Map(
    (companies ?? []).map((company) => [
      String(company.id).trim().toLowerCase(),
      {
        id: String(company.id),
        name: typeof company.name === "string" ? company.name : "—",
        slug: typeof company.slug === "string" ? company.slug : null,
        domain: typeof company.domain === "string" ? company.domain : null,
        logo_url: typeof company.logo_url === "string" ? company.logo_url : null,
      },
    ]),
  );

  return links.map((link) => {
    const row = toLinkRow(link as Record<string, unknown>);
    const companyKey = row.company_id.trim().toLowerCase();
    return {
      ...row,
      companies: companyById.get(companyKey) ?? null,
    };
  });
}

export async function getEventOrganizerLinkAdminById(
  linkId: string,
): Promise<EventOrganizerLinkAdminRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("event_edition_organizers")
    .select(ORGANIZER_LINK_SELECT)
    .eq("id", linkId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? toLinkRow(data as Record<string, unknown>) : null;
}

export async function createEventOrganizerLinkAdmin(
  editionId: string,
  payload: EventOrganizerCreatePayload,
): Promise<EventOrganizerLinkAdminRow> {
  const supabase = createAdminClient();
  const displayOrder = await nextDisplayOrderForEdition(supabase, editionId);
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("event_edition_organizers")
    .insert({
      event_editions_id: editionId,
      company_id: payload.company_id,
      role_label: payload.role_label,
      display_order: displayOrder,
      updated_at: nowIso,
    })
    .select(ORGANIZER_LINK_SELECT)
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION_CODE) {
      throw new Error(DUPLICATE_ORGANIZER_LINK_MESSAGE);
    }
    throw new Error(error.message);
  }

  return toLinkRow(data as Record<string, unknown>);
}

export async function updateEventOrganizerLinkAdmin(
  editionId: string,
  linkId: string,
  patch: EventOrganizerUpdatePatch,
): Promise<EventOrganizerLinkAdminRow> {
  const supabase = createAdminClient();
  const current = await getEventOrganizerLinkAdminById(linkId);
  if (!current || current.event_editions_id !== editionId) {
    throw new Error("Organizer link not found.");
  }

  if (!shouldAutoTouchOrganizerUpdate(current.role_label, patch.role_label)) {
    return current;
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("event_edition_organizers")
    .update({ role_label: patch.role_label, updated_at: nowIso })
    .eq("id", linkId)
    .eq("event_editions_id", editionId)
    .select(ORGANIZER_LINK_SELECT)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Organizer link not found.");

  return toLinkRow(data as Record<string, unknown>);
}

export async function deleteEventOrganizerLinkAdmin(
  editionId: string,
  linkId: string,
): Promise<EventOrganizerLinkAdminRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("event_edition_organizers")
    .delete()
    .eq("id", linkId)
    .eq("event_editions_id", editionId)
    .select(ORGANIZER_LINK_SELECT)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const row = data ? toLinkRow(data as Record<string, unknown>) : null;
  if (!row) {
    return null;
  }

  const remaining = await loadOrganizerSiblings(supabase, editionId);
  if (remaining.length > 0) {
    await renumberOrganizerDisplayOrder(
      supabase,
      editionId,
      remaining.map((item) => item.id),
    );
  }

  return row;
}

export async function reorderEventOrganizerLinkAdmin(
  editionId: string,
  payload: EventOrganizerReorderPayload,
): Promise<EventOrganizerLinkAdminRow[]> {
  const supabase = createAdminClient();
  const siblings = await loadOrganizerSiblings(supabase, editionId);
  const orderedLinkIds = siblings.map((row) => row.id);
  const nextOrder = computeMoveOrderedLinkIds(
    orderedLinkIds,
    payload.organizer_id,
    payload.direction,
  );

  if (nextOrder === null) {
    if (!orderedLinkIds.includes(payload.organizer_id)) {
      throw new Error("Organizer link not found.");
    }
    return siblings;
  }

  return renumberOrganizerDisplayOrder(supabase, editionId, nextOrder);
}
