import { NextResponse } from "next/server";

import { listCountriesAdmin } from "@/src/features/locations/server/locationAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const countries = await listCountriesAdmin();
    return NextResponse.json({ ok: true, countries });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
