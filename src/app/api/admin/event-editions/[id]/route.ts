import { NextResponse } from "next/server";

import { updateEventEdition } from "@/src/features/events/server/createEventEdition";
import {
  countLiveSponsorsForEdition,
  getEventEditionAdminById,
} from "@/src/features/events/server/eventEditionAdmin";
import { resolveEventManualLogoUrl } from "@/src/features/events/server/resolveEventManualLogoUrl";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";
import { formatEditionWriteError } from "@/src/lib/errors/editionWriteError";
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

  const validated = validateEditionUpdateBody({
    name: typeof body.name === "string" ? body.name : undefined,
    slug: typeof body.slug === "string" ? body.slug : undefined,
    start_date: body.start_date as string | null | undefined,
    end_date: body.end_date as string | null | undefined,
    website_url: body.website_url as string | null | undefined,
    logo_url: body.logo_url as string | null | undefined,
    city_id: body.city_id as string | null | undefined,
    series_id: typeof body.series_id === "string" ? body.series_id : undefined,
    year: body.year as number | string | undefined,
  });

  if (!validated.ok) {
    return NextResponse.json(
      { ok: false, error: validated.errors.join("; ") },
      { status: 400 },
    );
  }

  const warnings: string[] = [];

  if (body.logo_url !== undefined) {
    const existing = await getEventEditionAdminById(id);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Edition not found." }, { status: 404 });
    }

    const logoInput = validated.patch.logo_url as string | null;
    const resolved = await resolveEventManualLogoUrl({
      incomingLogoUrl: logoInput,
      existingLogoUrl: existing.logo_url,
      entityId: id,
      storageNamespace: "event-editions",
    });

    if (!resolved.ok) {
      warnings.push(resolved.warning);
      delete validated.patch.logo_url;
    } else if (resolved.applyPatch) {
      validated.patch.logo_url = resolved.logo_url;
    } else {
      delete validated.patch.logo_url;
    }
  }

  if (Object.keys(validated.patch).length === 0) {
    if (warnings.length > 0) {
      const edition = await getEventEditionAdminById(id);
      if (!edition) {
        return NextResponse.json({ ok: false, error: "Edition not found." }, { status: 404 });
      }
      return NextResponse.json({ ok: true, edition, warnings });
    }
    return NextResponse.json({ ok: false, error: "No fields to update." }, { status: 400 });
  }

  try {
    const edition = await updateEventEdition(id, {
      name: validated.patch.name as string | undefined,
      slug: validated.patch.slug as string | undefined,
      start_date: validated.patch.start_date as string | null | undefined,
      end_date: validated.patch.end_date as string | null | undefined,
      website_url: validated.patch.website_url as string | null | undefined,
      logo_url: validated.patch.logo_url as string | null | undefined,
      city_id: validated.patch.city_id as string | null | undefined,
    });
    return NextResponse.json({
      ok: true,
      edition,
      ...(warnings.length > 0 ? { warnings } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const friendly = formatEditionWriteError(message);
    const status = friendly !== message ? 409 : 500;
    return NextResponse.json({ ok: false, error: friendly }, { status });
  }
}
