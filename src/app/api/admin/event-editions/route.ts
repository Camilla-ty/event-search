import { NextResponse } from "next/server";

import { buildAdminEditionsCollection } from "@/src/features/events/server/adminEditionsCollection";
import { createEventEdition } from "@/src/features/events/server/createEventEdition";
import { parseEditionsListParams } from "@/src/features/events/server/editionsListParams";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";
import { formatEditionWriteError } from "@/src/lib/errors/editionWriteError";
import { buildEditionSlug } from "@/src/lib/slugify";
import { validateEditionVenueAttachment } from "@/src/lib/validation/editionVenue";
import { validateEditionCreateBody } from "@/src/lib/validation/eventEdition";

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const params = parseEditionsListParams(searchParams);
  const seriesId = searchParams.get("seriesId") ?? undefined;
  const yearRaw = searchParams.get("year");
  const year = yearRaw ? Number(yearRaw) : undefined;
  const search = searchParams.get("search") ?? undefined;

  try {
    const result = await buildAdminEditionsCollection(params, {
      seriesId,
      year: Number.isInteger(year) ? year : undefined,
      search,
    });
    return NextResponse.json({
      ok: true,
      editions: result.editions,
      total: result.total,
      params: result.params,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const slugFromBody = typeof body.slug === "string" ? body.slug : undefined;
  const name = typeof body.name === "string" ? body.name : "";
  const year =
    typeof body.year === "number" || typeof body.year === "string" ? body.year : undefined;
  const derivedSlug =
    slugFromBody && slugFromBody.trim() !== ""
      ? slugFromBody
      : buildEditionSlug(name, Number(year));

  const validated = validateEditionCreateBody({
    series_id: typeof body.series_id === "string" ? body.series_id : undefined,
    year,
    name,
    slug: derivedSlug,
    start_date: body.start_date as string | null | undefined,
    end_date: body.end_date as string | null | undefined,
    website_url: body.website_url as string | null | undefined,
    city_id: body.city_id as string | null | undefined,
    venue_id: body.venue_id as string | null | undefined,
    last_reviewed_at: body.last_reviewed_at as string | null | undefined,
    primary_source_url: body.primary_source_url as string | null | undefined,
    sponsor_note_type: body.sponsor_note_type as string | null | undefined,
  });

  if (!validated.ok) {
    return NextResponse.json(
      { ok: false, error: validated.errors.join("; ") },
      { status: 400 },
    );
  }

  try {
    const venueErrors = await validateEditionVenueAttachment({
      venueId: validated.data.venue_id,
      cityId: validated.data.city_id,
    });
    if (venueErrors.length > 0) {
      return NextResponse.json(
        { ok: false, error: venueErrors.join("; ") },
        { status: 400 },
      );
    }

    const edition = await createEventEdition(validated.data);
    return NextResponse.json({ ok: true, edition }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const friendly = formatEditionWriteError(message);
    const status = friendly !== message ? 409 : 500;
    return NextResponse.json({ ok: false, error: friendly }, { status });
  }
}
