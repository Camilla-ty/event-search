import { NextResponse } from "next/server";

import { archiveVenueAdmin, VenueAdminError } from "@/src/features/venues/server/venueAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  try {
    const result = await archiveVenueAdmin(id);
    return NextResponse.json({ ok: true, venue: result.venue });
  } catch (error) {
    if (error instanceof VenueAdminError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
