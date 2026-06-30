import { NextResponse } from "next/server";

import { createEventEdition } from "@/src/features/events/server/createEventEdition";
import { listEventEditionsAdmin } from "@/src/features/events/server/eventEditionAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";
import { formatEditionWriteError } from "@/src/lib/errors/editionWriteError";
import { buildEditionSlug } from "@/src/lib/slugify";
import { validateEditionCreateBody } from "@/src/lib/validation/eventEdition";

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const seriesId = searchParams.get("seriesId") ?? undefined;
  const yearRaw = searchParams.get("year");
  const year = yearRaw ? Number(yearRaw) : undefined;
  const search = searchParams.get("search") ?? undefined;

  try {
    const editions = await listEventEditionsAdmin({
      seriesId,
      year: Number.isInteger(year) ? year : undefined,
      missingWebsite: searchParams.get("missingWebsite") === "1",
      missingDates: searchParams.get("missingDates") === "1",
      missingCity: searchParams.get("missingCity") === "1",
      search,
    });
    return NextResponse.json({ ok: true, editions });
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
    last_reviewed_at: body.last_reviewed_at as string | null | undefined,
    primary_source_url: body.primary_source_url as string | null | undefined,
  });

  if (!validated.ok) {
    return NextResponse.json(
      { ok: false, error: validated.errors.join("; ") },
      { status: 400 },
    );
  }

  try {
    const edition = await createEventEdition(validated.data);
    return NextResponse.json({ ok: true, edition }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const friendly = formatEditionWriteError(message);
    const status = friendly !== message ? 409 : 500;
    return NextResponse.json({ ok: false, error: friendly }, { status });
  }
}
