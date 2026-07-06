import { NextResponse } from "next/server";

import {
  getPartnerAlumniAdminBySeriesId,
} from "@/src/features/partner-alumni/server/partnerAlumniAdmin";
import { getEventSeriesAdminById } from "@/src/features/events/server/eventSeriesAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id: seriesId } = await context.params;

  try {
    const series = await getEventSeriesAdminById(seriesId);
    if (!series) {
      return NextResponse.json({ ok: false, error: "Series not found." }, { status: 404 });
    }

    const data = await getPartnerAlumniAdminBySeriesId(seriesId);
    return NextResponse.json({ ok: true, ...data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
