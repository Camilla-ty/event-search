import { NextResponse } from "next/server";

import { listVenueOptionsForCityAdmin } from "@/src/features/venues/server/getVenueOptions";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";
import { parseOptionalUuid } from "@/src/lib/validation/eventEdition";

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const cityId = parseOptionalUuid(searchParams.get("cityId"));

  if (!cityId) {
    return NextResponse.json(
      { ok: false, error: "cityId must be a valid UUID." },
      { status: 400 },
    );
  }

  try {
    const venues = await listVenueOptionsForCityAdmin(cityId);
    return NextResponse.json({ ok: true, venues });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
