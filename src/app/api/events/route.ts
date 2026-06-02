import { NextResponse } from "next/server";

import { createEventEdition } from "@/src/features/events/server/createEventEdition";
import { getProfileRoleForUserId, isAdminRole } from "@/src/lib/auth/appProfile";
import { createClient } from "@/src/lib/supabase/server";

type CreateEventEditionBody = {
  series_id?: string;
  year?: number | string;
  name?: string;
  start_date?: string;
  end_date?: string;
  website_url?: string;
  city_id?: string;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildEditionSlug(name: string, year: number): string {
  return slugify(`${name} ${year}`);
}

function coerceYear(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isInteger(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw);
    if (Number.isInteger(n)) return n;
  }
  return null;
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  console.info("[api/events] request received", { requestId });

  // Authentication boundary: every write goes through `getUser()` first. The
  // service-role client is intentionally only used by helpers (e.g. `createEventEdition`)
  // AFTER we've confirmed the caller is authenticated.
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    console.warn("[api/events] unauthorized", {
      requestId,
      reason: authError?.message ?? "no_user",
    });
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  const role = await getProfileRoleForUserId(supabase, user.id);
  if (!isAdminRole(role)) {
    return NextResponse.json(
      { ok: false, error: "Forbidden." },
      { status: 403 },
    );
  }

  let body: CreateEventEditionBody;
  try {
    body = (await request.json()) as CreateEventEditionBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  const seriesId = body.series_id?.trim() ?? "";
  const cityId = body.city_id?.trim() ?? "";
  const name = body.name?.trim() ?? "";
  const websiteUrl = body.website_url?.trim() ?? "";
  const startDate = body.start_date?.trim() ?? "";
  const endDate = body.end_date?.trim() ?? "";
  const year = coerceYear(body.year);

  const errors: string[] = [];
  if (!UUID_REGEX.test(seriesId)) errors.push("series_id must be a valid UUID");
  if (!UUID_REGEX.test(cityId)) errors.push("city_id must be a valid UUID");
  if (year === null) errors.push("year must be an integer");
  if (!name) errors.push("name is required");
  if (!websiteUrl) errors.push("website_url is required");
  if (!ISO_DATE_REGEX.test(startDate))
    errors.push("start_date must be YYYY-MM-DD");
  if (!ISO_DATE_REGEX.test(endDate)) errors.push("end_date must be YYYY-MM-DD");
  if (
    ISO_DATE_REGEX.test(startDate) &&
    ISO_DATE_REGEX.test(endDate) &&
    startDate > endDate
  ) {
    errors.push("start_date must be on or before end_date");
  }

  if (errors.length > 0 || year === null) {
    console.error("[api/events] validation failed", { requestId, errors });
    return NextResponse.json(
      { ok: false, error: errors.join("; ") || "Invalid payload." },
      { status: 400 },
    );
  }

  const slug = buildEditionSlug(name, year);
  if (!slug) {
    return NextResponse.json(
      { ok: false, error: "Could not derive slug from name and year." },
      { status: 400 },
    );
  }

  try {
    const edition = await createEventEdition({
      series_id: seriesId,
      year,
      name,
      slug,
      start_date: startDate,
      end_date: endDate,
      website_url: websiteUrl,
      city_id: cityId,
    });

    console.info("[api/events] createEventEdition success", {
      requestId,
      id: edition.id,
      slug: edition.slug,
    });

    // Phase 2 hook: schedule OG image / banner enrichment via `after()` here.
    // e.g.
    // import { after } from "next/server";
    // after(() => enrichEventBanner(edition.id, edition.website_url));

    return NextResponse.json({ ok: true, edition }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[api/events] createEventEdition failed", {
      requestId,
      message,
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
