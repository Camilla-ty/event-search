import { NextResponse } from "next/server";

import { getEventEditionAdminById } from "@/src/features/events/server/eventEditionAdmin";
import {
  deleteEventOrganizerLinkAdmin,
  updateEventOrganizerLinkAdmin,
} from "@/src/features/organizers/server/eventOrganizerAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";
import { validateEventOrganizerUpdateBody } from "@/src/lib/validation/eventOrganizer";

type RouteContext = { params: Promise<{ id: string; organizerId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id, organizerId } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const validated = validateEventOrganizerUpdateBody(body);
  if (!validated.ok) {
    return NextResponse.json(
      { ok: false, error: validated.errors.join("; ") },
      { status: 400 },
    );
  }

  try {
    const edition = await getEventEditionAdminById(id);
    if (!edition) {
      return NextResponse.json({ ok: false, error: "Event not found." }, { status: 404 });
    }

    const link = await updateEventOrganizerLinkAdmin(id, organizerId, validated.patch);
    return NextResponse.json({ ok: true, link });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Organizer link not found." ? 404 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id, organizerId } = await context.params;

  try {
    const edition = await getEventEditionAdminById(id);
    if (!edition) {
      return NextResponse.json({ ok: false, error: "Event not found." }, { status: 404 });
    }

    const link = await deleteEventOrganizerLinkAdmin(id, organizerId);
    if (!link) {
      return NextResponse.json({ ok: false, error: "Organizer link not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, link });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
