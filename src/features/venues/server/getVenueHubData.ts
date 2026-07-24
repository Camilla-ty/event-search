import {
  mapPublicEditionRow,
} from "@/src/features/events/server/mapPublicEditionRow";
import { isUpcomingEdition } from "@/src/features/home/server/discoverEditionSelectors";
import type { PublicEditionSummary } from "@/src/features/events/types/publicEdition";
import { CITY_PUBLIC_EMBED } from "@/src/lib/location/cityEmbedSelect";
import { formatLocationFromCityEmbed } from "@/src/lib/location/parseLocationEmbed";
import { EVENT_EDITION_LIST_SELECT } from "@/src/lib/queries/events";
import { mapPublicLogoUrl } from "@/src/lib/storage/mapPublicLogoUrl";
import { createClient } from "@/src/lib/supabase/server";

const VENUE_HUB_SELECT = `
  id,
  name,
  slug,
  website_url,
  address_text,
  logo_url,
  archived_at,
  cities (
    *,
    ${CITY_PUBLIC_EMBED}
  )
`;

export type PublicVenueHub = {
  id: string;
  name: string;
  slug: string;
  website_url: string | null;
  address_text: string | null;
  logo_url: string | null;
  locationLabel: string;
};

export type VenueHubData = {
  venue: PublicVenueHub;
  editions: PublicEditionSummary[];
  upcoming: PublicEditionSummary[];
  past: PublicEditionSummary[];
};

function compareStringsAsc(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function readIsoDate(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (trimmed === "") return "";
  return /^\d{4}-\d{2}-\d{2}/.test(trimmed) ? trimmed.slice(0, 10) : "";
}

export function mapPublicVenueHubRow(
  raw: unknown,
): PublicVenueHub | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;

  if (typeof row.archived_at === "string" && row.archived_at.trim() !== "") {
    return null;
  }

  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (name === "") return null;

  const slug = typeof row.slug === "string" ? row.slug.trim() : "";
  const id = typeof row.id === "string" ? row.id.trim() : "";
  if (id === "") return null;

  return {
    id,
    name,
    slug,
    website_url: typeof row.website_url === "string" ? row.website_url : null,
    address_text: typeof row.address_text === "string" ? row.address_text : null,
    logo_url: mapPublicLogoUrl(typeof row.logo_url === "string" ? row.logo_url : null),
    locationLabel: formatLocationFromCityEmbed(row.cities),
  };
}

export function sortUpcomingEditionsSoonestFirst(
  editions: readonly PublicEditionSummary[],
): PublicEditionSummary[] {
  return editions.slice().sort((a, b) => {
    const startA = readIsoDate(a.start_date);
    const startB = readIsoDate(b.start_date);
    if (startA !== "" && startB !== "") {
      const byStart = compareStringsAsc(startA, startB);
      if (byStart !== 0) return byStart;
    } else if (startA !== "") {
      return -1;
    } else if (startB !== "") {
      return 1;
    }
    return compareStringsAsc(a.name, b.name);
  });
}

export function sortPastEditionsNewestFirst(
  editions: readonly PublicEditionSummary[],
): PublicEditionSummary[] {
  return editions.slice().sort((a, b) => {
    const startA = readIsoDate(a.start_date);
    const startB = readIsoDate(b.start_date);
    if (startA !== "" && startB !== "") {
      const byStart = compareStringsAsc(startB, startA);
      if (byStart !== 0) return byStart;
    } else if (startA !== "") {
      return -1;
    } else if (startB !== "") {
      return 1;
    }

    const yearA = a.year ?? -1;
    const yearB = b.year ?? -1;
    if (yearA !== yearB) return yearB - yearA;

    return compareStringsAsc(a.name, b.name);
  });
}

export function partitionEditionsForVenueHub(
  editions: readonly PublicEditionSummary[],
  today?: string,
): { upcoming: PublicEditionSummary[]; past: PublicEditionSummary[] } {
  const todayKey = today ?? new Date().toISOString().slice(0, 10);
  const upcoming: PublicEditionSummary[] = [];
  const past: PublicEditionSummary[] = [];

  for (const edition of editions) {
    if (isUpcomingEdition(edition, todayKey)) {
      upcoming.push(edition);
    } else {
      past.push(edition);
    }
  }

  return {
    upcoming: sortUpcomingEditionsSoonestFirst(upcoming),
    past: sortPastEditionsNewestFirst(past),
  };
}

async function fetchVenueByColumn(
  column: "slug" | "id",
  value: string,
): Promise<Record<string, unknown> | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("venues")
    .select(VENUE_HUB_SELECT)
    .eq(column, value)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || typeof data !== "object") return null;
  return data as Record<string, unknown>;
}

async function loadEditionsForVenue(
  venueId: string,
): Promise<PublicEditionSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_editions")
    .select(EVENT_EDITION_LIST_SELECT)
    .eq("venue_id", venueId)
    .order("start_date", { ascending: false })
    .order("year", { ascending: false });

  if (error) throw new Error(error.message);

  const editions: PublicEditionSummary[] = [];
  for (const row of data ?? []) {
    const mapped = mapPublicEditionRow(row);
    if (mapped) editions.push(mapped);
  }
  return editions;
}

export async function getVenueHubData(
  identifier: string,
): Promise<VenueHubData | null> {
  const trimmed = identifier.trim();
  if (trimmed === "") return null;

  const raw =
    (await fetchVenueByColumn("slug", trimmed)) ??
    (await fetchVenueByColumn("id", trimmed));

  const venue = mapPublicVenueHubRow(raw);
  if (!venue) return null;

  const editions = await loadEditionsForVenue(venue.id);
  const { upcoming, past } = partitionEditionsForVenueHub(editions);

  return { venue, editions, upcoming, past };
}
