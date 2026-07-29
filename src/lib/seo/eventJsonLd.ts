import { isCompanyRestricted } from "@/src/lib/companies/companyPublicRestriction";
import { readEventIsoDate } from "@/src/features/events/lib/readEventIsoDate";
import { getSiteUrl } from "@/src/lib/metadata/site";
import {
  buildEventDetailPath,
  buildSeriesHubPath,
  buildSponsorProfilePath,
} from "@/src/lib/routes/explorerUrls";

const SCHEMA_CONTEXT = "https://schema.org";

export type EventJsonLdCityInput = {
  city?: string | null;
  state?: string | null;
  country?: string | null;
};

export type EventJsonLdVenueInput = {
  name: string;
  archived_at?: string | null;
};

export type EventJsonLdOrganizerInput = {
  name: string;
  slug?: string | null;
  id?: string | null;
  restricted_at?: string | null;
};

export type EventJsonLdSeriesInput = {
  name: string;
  slug?: string | null;
  id?: string | null;
};

export type BuildEventJsonLdInput = {
  name: string;
  slug?: string | null;
  id?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  city?: EventJsonLdCityInput | null;
  venue?: EventJsonLdVenueInput | null;
  organizers?: readonly EventJsonLdOrganizerInput[] | null;
  /** Absolute http(s) series logo URL only; relative / empty omitted. */
  imageUrl?: string | null;
  /** Exact factual summary already shown in the page body. */
  description?: string | null;
  series?: EventJsonLdSeriesInput | null;
  /** Override for tests; defaults to `getSiteUrl()`. */
  siteUrl?: URL;
};

export type EventJsonLd = {
  "@context": typeof SCHEMA_CONTEXT;
  "@type": "Event";
  "@id": string;
  name: string;
  url: string;
  startDate?: string;
  endDate?: string;
  location?: Record<string, unknown>;
  organizer?: Record<string, unknown> | Array<Record<string, unknown>>;
  image?: string;
  description?: string;
  isPartOf?: Record<string, unknown>;
};

function trimText(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function absoluteUrlFromPath(path: string, siteUrl: URL): string {
  return new URL(path.replace(/^\//, ""), siteUrl).toString();
}

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function buildLocation(
  city: EventJsonLdCityInput | null | undefined,
  venue: EventJsonLdVenueInput | null | undefined,
): Record<string, unknown> | undefined {
  const venueName =
    venue && venue.archived_at == null ? trimText(venue.name) : "";
  const locality = trimText(city?.city);
  const region = trimText(city?.state);
  const country = trimText(city?.country);

  const hasAddress = locality !== "" || region !== "" || country !== "";
  if (venueName === "" && !hasAddress) {
    return undefined;
  }

  const place: Record<string, unknown> = {
    "@type": "Place",
  };

  if (venueName !== "") {
    place.name = venueName;
  }

  if (hasAddress) {
    const address: Record<string, unknown> = {
      "@type": "PostalAddress",
    };
    if (locality !== "") address.addressLocality = locality;
    if (region !== "") address.addressRegion = region;
    if (country !== "") address.addressCountry = country;
    place.address = address;
  }

  return place;
}

function buildOrganizers(
  organizers: readonly EventJsonLdOrganizerInput[] | null | undefined,
  siteUrl: URL,
): Record<string, unknown> | Array<Record<string, unknown>> | undefined {
  if (!organizers || organizers.length === 0) return undefined;

  const items: Array<Record<string, unknown>> = [];
  for (const organizer of organizers) {
    if (isCompanyRestricted(organizer)) continue;
    const name = trimText(organizer.name);
    if (name === "") continue;

    const org: Record<string, unknown> = {
      "@type": "Organization",
      name,
    };

    const profilePath = buildSponsorProfilePath({
      slug: organizer.slug,
      id: organizer.id,
    });
    if (profilePath) {
      org.url = absoluteUrlFromPath(profilePath, siteUrl);
    }

    items.push(org);
  }

  if (items.length === 0) return undefined;
  return items.length === 1 ? items[0] : items;
}

function buildIsPartOf(
  series: EventJsonLdSeriesInput | null | undefined,
  siteUrl: URL,
): Record<string, unknown> | undefined {
  if (!series) return undefined;
  const name = trimText(series.name);
  if (name === "") return undefined;

  const hubPath = buildSeriesHubPath({ slug: series.slug, id: series.id });
  if (!hubPath) return undefined;

  return {
    "@type": "Brand",
    name,
    url: absoluteUrlFromPath(hubPath, siteUrl),
  };
}

/**
 * Builds schema.org Event JSON-LD from confirmed public Event Detail facts.
 * Returns null when name or canonical path cannot be established.
 */
export function buildEventJsonLd(
  input: BuildEventJsonLdInput,
): EventJsonLd | null {
  const name = trimText(input.name);
  if (name === "") return null;

  const path = buildEventDetailPath({ slug: input.slug, id: input.id });
  if (!path) return null;

  const siteUrl = input.siteUrl ?? getSiteUrl();
  const url = absoluteUrlFromPath(path, siteUrl);

  const event: EventJsonLd = {
    "@context": SCHEMA_CONTEXT,
    "@type": "Event",
    "@id": url,
    name,
    url,
  };

  const startDate = readEventIsoDate(input.startDate);
  if (startDate !== "") {
    event.startDate = startDate;
  }

  const endDate = readEventIsoDate(input.endDate);
  if (endDate !== "" && (startDate === "" || endDate >= startDate)) {
    event.endDate = endDate;
  }

  const location = buildLocation(input.city, input.venue);
  if (location) {
    event.location = location;
  }

  const organizer = buildOrganizers(input.organizers, siteUrl);
  if (organizer) {
    event.organizer = organizer;
  }

  const imageUrl = trimText(input.imageUrl);
  if (imageUrl !== "" && isAbsoluteHttpUrl(imageUrl)) {
    event.image = imageUrl;
  }

  const description = trimText(input.description);
  if (description !== "") {
    event.description = description;
  }

  const isPartOf = buildIsPartOf(input.series, siteUrl);
  if (isPartOf) {
    event.isPartOf = isPartOf;
  }

  return event;
}
