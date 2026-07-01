import { NextResponse } from "next/server";

import {
  getVenueAdminById,
  updateVenueAdmin,
  VenueAdminError,
} from "@/src/features/venues/server/venueAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";
import { slugify } from "@/src/lib/slugify";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  try {
    const venue = await getVenueAdminById(id);
    if (!venue) {
      return NextResponse.json({ ok: false, error: "Venue not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, venue });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

type PatchVenueBody = {
  name?: string;
  slug?: string;
  city_id?: string;
  website_url?: string | null;
  address_text?: string | null;
  logo_url?: string | null;
  archived_at?: unknown;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  let body: PatchVenueBody;
  try {
    body = (await request.json()) as PatchVenueBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const patch: PatchVenueBody = { ...body };
  if (body.slug !== undefined) {
    patch.slug = slugify(body.slug.trim());
  }

  try {
    const result = await updateVenueAdmin(id, patch);
    return NextResponse.json({
      ok: true,
      venue: result.venue,
      ...(result.warnings.length > 0 ? { warnings: result.warnings } : {}),
    });
  } catch (error) {
    if (error instanceof VenueAdminError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("unique") ? 409 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
