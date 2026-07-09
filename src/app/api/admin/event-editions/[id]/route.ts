import { NextResponse } from "next/server";

import { updateEventEdition } from "@/src/features/events/server/createEventEdition";
import {
  countLiveSponsorsForEdition,
  getEventEditionAdminById,
} from "@/src/features/events/server/eventEditionAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";
import { formatEditionWriteError } from "@/src/lib/errors/editionWriteError";
import { validateEditionVenueAttachment } from "@/src/lib/validation/editionVenue";
import { validateEditionUpdateBody } from "@/src/lib/validation/eventEdition";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  try {
    const edition = await getEventEditionAdminById(id);
    if (!edition) {
      return NextResponse.json({ ok: false, error: "Edition not found." }, { status: 404 });
    }
    const live_sponsor_count = await countLiveSponsorsForEdition(id);
    return NextResponse.json({ ok: true, edition, live_sponsor_count });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const existing = await getEventEditionAdminById(id);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Edition not found." }, { status: 404 });
  }

  const validated = validateEditionUpdateBody({
    name: typeof body.name === "string" ? body.name : undefined,
    slug: typeof body.slug === "string" ? body.slug : undefined,
    start_date: body.start_date as string | null | undefined,
    end_date: body.end_date as string | null | undefined,
    website_url: body.website_url as string | null | undefined,
    logo_url: body.logo_url as string | null | undefined,
    city_id: body.city_id as string | null | undefined,
    venue_id: body.venue_id as string | null | undefined,
    last_reviewed_at: body.last_reviewed_at as string | null | undefined,
    primary_source_url: body.primary_source_url as string | null | undefined,
    sponsor_note_type: body.sponsor_note_type as string | null | undefined,
    series_id: typeof body.series_id === "string" ? body.series_id : undefined,
    year: body.year as number | string | undefined,
  });

  if (!validated.ok) {
    return NextResponse.json(
      { ok: false, error: validated.errors.join("; ") },
      { status: 400 },
    );
  }

  if (Object.keys(validated.patch).length === 0) {
    return NextResponse.json({ ok: false, error: "No fields to update." }, { status: 400 });
  }

  try {
    const finalCityId =
      validated.patch.city_id !== undefined
        ? (validated.patch.city_id as string | null)
        : existing.city_id;
    const finalVenueId =
      validated.patch.venue_id !== undefined
        ? (validated.patch.venue_id as string | null)
        : existing.venue_id ?? null;

    const venueErrors = await validateEditionVenueAttachment({
      venueId: finalVenueId,
      cityId: finalCityId,
      previousVenueId: existing.venue_id,
    });
    if (venueErrors.length > 0) {
      return NextResponse.json(
        { ok: false, error: venueErrors.join("; ") },
        { status: 400 },
      );
    }

    const edition = await updateEventEdition(id, {
      name: validated.patch.name as string | undefined,
      slug: validated.patch.slug as string | undefined,
      start_date: validated.patch.start_date as string | null | undefined,
      end_date: validated.patch.end_date as string | null | undefined,
      website_url: validated.patch.website_url as string | null | undefined,
      city_id: validated.patch.city_id as string | null | undefined,
      venue_id: validated.patch.venue_id as string | null | undefined,
      last_reviewed_at: validated.patch.last_reviewed_at as string | null | undefined,
      primary_source_url: validated.patch.primary_source_url as string | null | undefined,
      sponsor_note_type: validated.patch.sponsor_note_type as string | null | undefined,
    });
    return NextResponse.json({ ok: true, edition });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const friendly = formatEditionWriteError(message);
    const status = friendly !== message ? 409 : 500;
    return NextResponse.json({ ok: false, error: friendly }, { status: status });
  }
}
