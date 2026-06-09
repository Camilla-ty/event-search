import { NextResponse } from "next/server";

import { findSiblingEditions } from "@/src/features/events/server/eventEditionAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";
import { coerceYear } from "@/src/lib/validation/eventEdition";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const seriesId = searchParams.get("seriesId")?.trim() ?? "";
  const year = coerceYear(searchParams.get("year"));
  const excludeId = searchParams.get("excludeId")?.trim();

  if (!UUID_REGEX.test(seriesId)) {
    return NextResponse.json(
      { ok: false, error: "seriesId must be a valid UUID." },
      { status: 400 },
    );
  }
  if (year === null || year < 1900 || year > 2999) {
    return NextResponse.json(
      { ok: false, error: "year must be an integer between 1900 and 2999." },
      { status: 400 },
    );
  }
  if (excludeId !== undefined && excludeId !== "" && !UUID_REGEX.test(excludeId)) {
    return NextResponse.json(
      { ok: false, error: "excludeId must be a valid UUID." },
      { status: 400 },
    );
  }

  try {
    const siblings = await findSiblingEditions({
      seriesId,
      year,
      excludeId: excludeId !== "" ? excludeId : undefined,
    });
    return NextResponse.json({ ok: true, siblings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
