import { NextResponse } from "next/server";

import { listStatesByCountryAdmin } from "@/src/features/locations/server/locationAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const countryId = new URL(request.url).searchParams.get("countryId")?.trim() ?? "";
  if (!UUID_REGEX.test(countryId)) {
    return NextResponse.json(
      { ok: false, error: "countryId must be a valid UUID." },
      { status: 400 },
    );
  }

  try {
    const states = await listStatesByCountryAdmin(countryId);
    return NextResponse.json({ ok: true, states });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
