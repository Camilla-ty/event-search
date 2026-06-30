import { isValidHttpUrl } from "@/src/lib/validation/url";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function coerceYear(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isInteger(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw);
    if (Number.isInteger(n)) return n;
  }
  return null;
}

export function parseOptionalDate(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value === "") return null;
  return ISO_DATE_REGEX.test(value) ? value : null;
}

export function parseOptionalUuid(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value === "") return null;
  return UUID_REGEX.test(value) ? value : null;
}

function parseOptionalReviewedAt(raw: unknown): string | null {
  const date = parseOptionalDate(raw);
  if (date !== null) {
    return `${date}T00:00:00.000Z`;
  }
  if (raw === null || raw === undefined) return null;
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value === "") return null;
  return null;
}

export type EditionCreatePayload = {
  series_id: string;
  year: number;
  name: string;
  slug: string;
  start_date: string | null;
  end_date: string | null;
  website_url: string | null;
  city_id: string | null;
  last_reviewed_at: string | null;
  primary_source_url: string | null;
};

export function validateEditionCreateBody(body: {
  series_id?: string;
  year?: number | string;
  name?: string;
  slug?: string;
  start_date?: string | null;
  end_date?: string | null;
  website_url?: string | null;
  city_id?: string | null;
  last_reviewed_at?: string | null;
  primary_source_url?: string | null;
}): { ok: true; data: EditionCreatePayload } | { ok: false; errors: string[] } {
  const seriesId = body.series_id?.trim() ?? "";
  const name = body.name?.trim() ?? "";
  const slug = body.slug?.trim() ?? "";
  const year = coerceYear(body.year);
  const startDate = parseOptionalDate(body.start_date);
  const endDate = parseOptionalDate(body.end_date);
  const cityId = parseOptionalUuid(body.city_id);
  const websiteRaw = body.website_url;
  const websiteUrl =
    websiteRaw === null || websiteRaw === undefined
      ? null
      : typeof websiteRaw === "string" && websiteRaw.trim() !== ""
        ? websiteRaw.trim()
        : null;

  const errors: string[] = [];
  if (!UUID_REGEX.test(seriesId)) errors.push("series_id must be a valid UUID");
  if (year === null || year < 1900 || year > 2999) {
    errors.push("year must be an integer between 1900 and 2999");
  }
  if (!name) errors.push("name is required");
  if (!slug) errors.push("slug is required");

  if (body.start_date !== undefined && body.start_date !== null && body.start_date !== "") {
    if (startDate === null) errors.push("start_date must be YYYY-MM-DD");
  }
  if (body.end_date !== undefined && body.end_date !== null && body.end_date !== "") {
    if (endDate === null) errors.push("end_date must be YYYY-MM-DD");
  }
  if (startDate && endDate && startDate > endDate) {
    errors.push("start_date must be on or before end_date");
  }
  if (body.city_id !== undefined && body.city_id !== null && body.city_id !== "") {
    if (cityId === null) errors.push("city_id must be a valid UUID");
  }
  if (websiteUrl && !isValidHttpUrl(websiteUrl)) {
    errors.push("website_url must be a valid URL");
  }

  let lastReviewedAt: string | null = null;
  if (body.last_reviewed_at !== undefined) {
    const parsed = parseOptionalReviewedAt(body.last_reviewed_at);
    if (
      body.last_reviewed_at !== null &&
      body.last_reviewed_at !== "" &&
      parsed === null
    ) {
      errors.push("last_reviewed_at must be YYYY-MM-DD");
    } else {
      lastReviewedAt = parsed;
    }
  }

  let primarySourceUrl: string | null = null;
  if (body.primary_source_url !== undefined) {
    primarySourceUrl =
      body.primary_source_url === null || body.primary_source_url === ""
        ? null
        : body.primary_source_url.trim();
    if (primarySourceUrl && !isValidHttpUrl(primarySourceUrl)) {
      errors.push("primary_source_url must be a valid URL");
    }
  }

  if (errors.length > 0 || year === null) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      series_id: seriesId,
      year,
      name,
      slug,
      start_date: startDate,
      end_date: endDate,
      website_url: websiteUrl,
      city_id: cityId,
      last_reviewed_at: lastReviewedAt,
      primary_source_url: primarySourceUrl,
    },
  };
}

export function validateEditionUpdateBody(body: {
  name?: string;
  slug?: string;
  start_date?: string | null;
  end_date?: string | null;
  website_url?: string | null;
  logo_url?: string | null;
  city_id?: string | null;
  last_reviewed_at?: string | null;
  primary_source_url?: string | null;
  series_id?: string;
  year?: number | string;
}): { ok: true; patch: Record<string, unknown> } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  if (body.series_id !== undefined) {
    errors.push("series_id cannot be changed");
  }
  if (body.year !== undefined) {
    errors.push("year cannot be changed");
  }
  if (body.logo_url !== undefined) {
    errors.push("logo_url cannot be updated on event editions; edit the event series logo instead");
  }

  const patch: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) errors.push("name cannot be empty");
    else patch.name = name;
  }
  if (body.slug !== undefined) {
    const slug = body.slug.trim();
    if (!slug) errors.push("slug cannot be empty");
    else patch.slug = slug;
  }
  if (body.start_date !== undefined) {
    const startDate = parseOptionalDate(body.start_date);
    if (body.start_date !== null && body.start_date !== "" && startDate === null) {
      errors.push("start_date must be YYYY-MM-DD");
    } else {
      patch.start_date = startDate;
    }
  }
  if (body.end_date !== undefined) {
    const endDate = parseOptionalDate(body.end_date);
    if (body.end_date !== null && body.end_date !== "" && endDate === null) {
      errors.push("end_date must be YYYY-MM-DD");
    } else {
      patch.end_date = endDate;
    }
  }
  if (body.website_url !== undefined) {
    const websiteUrl =
      body.website_url === null || body.website_url === ""
        ? null
        : body.website_url.trim();
    if (websiteUrl && !isValidHttpUrl(websiteUrl)) {
      errors.push("website_url must be a valid URL");
    } else {
      patch.website_url = websiteUrl;
    }
  }
  if (body.city_id !== undefined) {
    const cityId = parseOptionalUuid(body.city_id);
    if (body.city_id !== null && body.city_id !== "" && cityId === null) {
      errors.push("city_id must be a valid UUID");
    } else {
      patch.city_id = cityId;
    }
  }
  if (body.last_reviewed_at !== undefined) {
    const reviewedAt = parseOptionalReviewedAt(body.last_reviewed_at);
    if (
      body.last_reviewed_at !== null &&
      body.last_reviewed_at !== "" &&
      reviewedAt === null
    ) {
      errors.push("last_reviewed_at must be YYYY-MM-DD");
    } else {
      patch.last_reviewed_at = reviewedAt;
    }
  }
  if (body.primary_source_url !== undefined) {
    const primarySourceUrl =
      body.primary_source_url === null || body.primary_source_url === ""
        ? null
        : body.primary_source_url.trim();
    if (primarySourceUrl && !isValidHttpUrl(primarySourceUrl)) {
      errors.push("primary_source_url must be a valid URL");
    } else {
      patch.primary_source_url = primarySourceUrl;
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, patch };
}
