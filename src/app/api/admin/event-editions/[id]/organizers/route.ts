import { NextResponse } from "next/server";

import { getEventEditionAdminById } from "@/src/features/events/server/eventEditionAdmin";
import {
  DUPLICATE_ORGANIZER_LINK_MESSAGE,
  createEventOrganizerLinkAdmin,
  getOrganizersForEditionAdmin,
} from "@/src/features/organizers/server/eventOrganizerAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";
import { validateEventOrganizerCreateBody } from "@/src/lib/validation/eventOrganizer";

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

    const organizers = await getOrganizersForEditionAdmin(id);
    return NextResponse.json({ ok: true, organizers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const validated = validateEventOrganizerCreateBody(body);
  if (!validated.ok) {
    return NextResponse.json(
      { ok: false, error: validated.errors.join("; ") },
      { status: 400 },
    );
  }

  try {
    const edition = await getEventEditionAdminById(id);
    if (!edition) {
      return NextResponse.json({ ok: false, error: "Edition not found." }, { status: 404 });
    }

    const link = await createEventOrganizerLinkAdmin(id, validated.data);
    return NextResponse.json({ ok: true, link });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === DUPLICATE_ORGANIZER_LINK_MESSAGE ? 409 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
