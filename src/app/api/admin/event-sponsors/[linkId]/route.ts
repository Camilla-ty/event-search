import { NextResponse } from "next/server";

import {
  getEventSponsorLinkAdminById,
  updateEventSponsorLinkAdmin,
} from "@/src/features/events/server/eventSponsorAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";
import { validateEventSponsorUpdateBody } from "@/src/lib/validation/eventSponsor";

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

  const validated = validateEventSponsorUpdateBody(body);
  if (!validated.ok) {
    return NextResponse.json(
      { ok: false, error: validated.errors.join("; ") },
      { status: 400 },
    );
  }

  try {
    const existing = await getEventSponsorLinkAdminById(linkId);
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Sponsor link not found." },
        { status: 404 },
      );
    }

    const link = await updateEventSponsorLinkAdmin(linkId, validated.patch);
    return NextResponse.json({ ok: true, link });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
