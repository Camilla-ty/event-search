import { NextResponse } from "next/server";

import {
  createPartnerAlumniVersionAdmin,
  mapPartnerAlumniAdminError,
  PartnerAlumniAdminError,
} from "@/src/features/partner-alumni/server/partnerAlumniAdmin";
import { getEventSeriesAdminById } from "@/src/features/events/server/eventSeriesAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";
import { validatePartnerAlumniCreateVersionBody } from "@/src/lib/validation/partnerAlumni";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id: seriesId } = await context.params;

  let body: Record<string, unknown> = {};
  try {
    const text = await request.text();
    if (text.trim() !== "") {
      body = JSON.parse(text) as Record<string, unknown>;
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const validated = validatePartnerAlumniCreateVersionBody(body);
  if (!validated.ok) {
    return NextResponse.json(
      { ok: false, error: validated.errors.join("; ") },
      { status: 400 },
    );
  }

  try {
    const series = await getEventSeriesAdminById(seriesId);
    if (!series) {
      return NextResponse.json({ ok: false, error: "Series not found." }, { status: 404 });
    }

    const data = await createPartnerAlumniVersionAdmin(seriesId, validated.mode);
    return NextResponse.json({ ok: true, ...data });
  } catch (error) {
    if (error instanceof PartnerAlumniAdminError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const mapped = mapPartnerAlumniAdminError(error);
    return NextResponse.json({ ok: false, error: mapped.message }, { status: mapped.status });
  }
}
