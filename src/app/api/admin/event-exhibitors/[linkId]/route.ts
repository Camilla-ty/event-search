import { NextResponse } from "next/server";

import {
  deleteEventExhibitorLinkAdmin,
  getEventExhibitorLinkAdminById,
  updateEventExhibitorLinkAdmin,
} from "@/src/features/exhibitors/server/eventExhibitorAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";
import { validateEventExhibitorUpdateBody } from "@/src/lib/validation/eventExhibitor";

type RouteContext = { params: Promise<{ linkId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { linkId } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const validated = validateEventExhibitorUpdateBody(body);
  if (!validated.ok) {
    return NextResponse.json(
      { ok: false, error: validated.errors.join("; ") },
      { status: 400 },
    );
  }

  try {
    const existing = await getEventExhibitorLinkAdminById(linkId);
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Exhibitor link not found." },
        { status: 404 },
      );
    }

    const link = await updateEventExhibitorLinkAdmin(linkId, validated.patch);
    return NextResponse.json({ ok: true, link });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { linkId } = await context.params;

  try {
    const link = await deleteEventExhibitorLinkAdmin(linkId);
    if (!link) {
      return NextResponse.json(
        { ok: false, error: "Exhibitor link not found." },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, link });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
