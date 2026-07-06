import { NextResponse } from "next/server";

import {
  mapPartnerAlumniAdminError,
  movePartnerAlumniVersionMemberAdmin,
  PartnerAlumniAdminError,
  reorderPartnerAlumniVersionMembersAdmin,
} from "@/src/features/partner-alumni/server/partnerAlumniAdmin";
import { getEventSeriesAdminById } from "@/src/features/events/server/eventSeriesAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";
import {
  validatePartnerAlumniMoveMemberBody,
  validatePartnerAlumniReorderBody,
} from "@/src/lib/validation/partnerAlumni";

type RouteContext = { params: Promise<{ id: string; versionId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id: seriesId, versionId } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  try {
    const series = await getEventSeriesAdminById(seriesId);
    if (!series) {
      return NextResponse.json({ ok: false, error: "Series not found." }, { status: 404 });
    }

    if ("ordered_member_ids" in body) {
      const validated = validatePartnerAlumniReorderBody(body);
      if (!validated.ok) {
        return NextResponse.json(
          { ok: false, error: validated.errors.join("; ") },
          { status: 400 },
        );
      }
      const data = await reorderPartnerAlumniVersionMembersAdmin(
        seriesId,
        versionId,
        validated.data,
      );
      return NextResponse.json({ ok: true, ...data });
    }

    const moveValidated = validatePartnerAlumniMoveMemberBody(body);
    if (!moveValidated.ok) {
      return NextResponse.json(
        { ok: false, error: moveValidated.errors.join("; ") },
        { status: 400 },
      );
    }

    const data = await movePartnerAlumniVersionMemberAdmin(
      seriesId,
      versionId,
      moveValidated.member_id,
      moveValidated.direction,
    );
    return NextResponse.json({ ok: true, ...data });
  } catch (error) {
    if (error instanceof PartnerAlumniAdminError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const mapped = mapPartnerAlumniAdminError(error);
    return NextResponse.json({ ok: false, error: mapped.message }, { status: mapped.status });
  }
}
