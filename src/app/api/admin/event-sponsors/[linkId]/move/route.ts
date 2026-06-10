import { NextResponse } from "next/server";

import { moveEventSponsorLinkAdmin } from "@/src/features/events/server/eventSponsorAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";
import { validateEventSponsorMoveBody } from "@/src/lib/validation/eventSponsor";

type RouteContext = { params: Promise<{ linkId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { linkId } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const validated = validateEventSponsorMoveBody(body);
  if (!validated.ok) {
    return NextResponse.json(
      { ok: false, error: validated.errors.join("; ") },
      { status: 400 },
    );
  }

  try {
    const link = await moveEventSponsorLinkAdmin(linkId, validated.direction);
    if (!link) {
      return NextResponse.json(
        { ok: false, error: "Sponsor link not found." },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, link });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
