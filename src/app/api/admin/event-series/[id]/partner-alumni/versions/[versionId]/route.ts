import { NextResponse } from "next/server";

import {
  deletePartnerAlumniVersionAdmin,
  getPartnerAlumniAdminBySeriesId,
  mapPartnerAlumniAdminError,
  PartnerAlumniAdminError,
  updatePartnerAlumniVersionHeaderAdmin,
} from "@/src/features/partner-alumni/server/partnerAlumniAdmin";
import { getEventSeriesAdminById } from "@/src/features/events/server/eventSeriesAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";
import { validatePartnerAlumniVersionHeaderPatchBody } from "@/src/lib/validation/partnerAlumni";

type RouteContext = { params: Promise<{ id: string; versionId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id: seriesId, versionId } = await context.params;

  try {
    const series = await getEventSeriesAdminById(seriesId);
    if (!series) {
      return NextResponse.json({ ok: false, error: "Series not found." }, { status: 404 });
    }

    const data = await getPartnerAlumniAdminBySeriesId(seriesId, {
      selectedVersionId: versionId,
    });
    if (!data.selected_version) {
      return NextResponse.json(
        { ok: false, error: "Partner Alumni version not found." },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, ...data });
  } catch (error) {
    const mapped = mapPartnerAlumniAdminError(error);
    return NextResponse.json({ ok: false, error: mapped.message }, { status: mapped.status });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id: seriesId, versionId } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const validated = validatePartnerAlumniVersionHeaderPatchBody(body);
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

    const data = await updatePartnerAlumniVersionHeaderAdmin(
      seriesId,
      versionId,
      validated.patch,
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

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id: seriesId, versionId } = await context.params;

  try {
    const series = await getEventSeriesAdminById(seriesId);
    if (!series) {
      return NextResponse.json({ ok: false, error: "Series not found." }, { status: 404 });
    }

    const data = await deletePartnerAlumniVersionAdmin(seriesId, versionId);
    return NextResponse.json({ ok: true, ...data });
  } catch (error) {
    if (error instanceof PartnerAlumniAdminError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const mapped = mapPartnerAlumniAdminError(error);
    return NextResponse.json({ ok: false, error: mapped.message }, { status: mapped.status });
  }
}
