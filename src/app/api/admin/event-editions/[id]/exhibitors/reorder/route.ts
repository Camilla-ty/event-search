import { NextResponse } from "next/server";

import { getEventEditionAdminById } from "@/src/features/events/server/eventEditionAdmin";
import { reorderEventExhibitorLinksInTierAdmin } from "@/src/features/exhibitors/server/eventExhibitorAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";
import { validateEventExhibitorReorderBody } from "@/src/lib/validation/eventExhibitor";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id: editionId } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const validated = validateEventExhibitorReorderBody(body);
  if (!validated.ok) {
    return NextResponse.json(
      { ok: false, error: validated.errors.join("; ") },
      { status: 400 },
    );
  }

  try {
    const edition = await getEventEditionAdminById(editionId);
    if (!edition) {
      return NextResponse.json({ ok: false, error: "Event not found." }, { status: 404 });
    }

    const links = await reorderEventExhibitorLinksInTierAdmin(editionId, validated.data);
    return NextResponse.json({ ok: true, links });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const isClientReorderError =
      message.startsWith("ordered_link_ids ") ||
      message.includes("Exhibitor ordering is out of sync");
    return NextResponse.json(
      { ok: false, error: message },
      { status: isClientReorderError ? 400 : 500 },
    );
  }
}
