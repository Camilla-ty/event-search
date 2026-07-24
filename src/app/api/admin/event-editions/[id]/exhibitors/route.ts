import { NextResponse } from "next/server";

import { getEventEditionAdminById } from "@/src/features/events/server/eventEditionAdmin";
import {
  DUPLICATE_EXHIBITOR_LINK_MESSAGE,
  countLiveExhibitorsForEdition,
  createEventExhibitorLinkAdmin,
  getLiveExhibitorsForEditionAdmin,
} from "@/src/features/exhibitors/server/eventExhibitorAdmin";
import { COMPANY_NOT_LINKABLE_MESSAGE } from "@/src/lib/companies/assertCompanyLinkable";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";
import { validateEventExhibitorCreateBody } from "@/src/lib/validation/eventExhibitor";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  try {
    const edition = await getEventEditionAdminById(id);
    if (!edition) {
      return NextResponse.json({ ok: false, error: "Event not found." }, { status: 404 });
    }

    const [exhibitors, count] = await Promise.all([
      getLiveExhibitorsForEditionAdmin(id),
      countLiveExhibitorsForEdition(id),
    ]);

    return NextResponse.json({ ok: true, exhibitors, count });
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

  const validated = validateEventExhibitorCreateBody(body);
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

    const link = await createEventExhibitorLinkAdmin(id, validated.data);
    return NextResponse.json({ ok: true, link });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      message === DUPLICATE_EXHIBITOR_LINK_MESSAGE
        ? 409
        : message === COMPANY_NOT_LINKABLE_MESSAGE
          ? 400
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
