import { NextResponse } from "next/server";

import {
  mapPartnerAlumniAdminError,
  PartnerAlumniAdminError,
  setPartnerAlumniCurrentVersionAdmin,
} from "@/src/features/partner-alumni/server/partnerAlumniAdmin";
import { getEventSeriesAdminById } from "@/src/features/events/server/eventSeriesAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

type RouteContext = { params: Promise<{ id: string; versionId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id: seriesId, versionId } = await context.params;

  try {
    const series = await getEventSeriesAdminById(seriesId);
    if (!series) {
      return NextResponse.json({ ok: false, error: "Series not found." }, { status: 404 });
    }

    const data = await setPartnerAlumniCurrentVersionAdmin(seriesId, versionId);
    return NextResponse.json({ ok: true, ...data });
  } catch (error) {
    if (error instanceof PartnerAlumniAdminError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const mapped = mapPartnerAlumniAdminError(error);
    return NextResponse.json({ ok: false, error: mapped.message }, { status: mapped.status });
  }
}
