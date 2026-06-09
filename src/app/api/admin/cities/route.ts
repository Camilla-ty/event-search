import { NextResponse } from "next/server";

import { createCityAdmin } from "@/src/features/locations/server/locationAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name : "";
  const countryId = typeof body.country_id === "string" ? body.country_id : "";
  const stateRaw = body.state_id;
  const stateId =
    stateRaw === null || stateRaw === undefined
      ? null
      : typeof stateRaw === "string"
        ? stateRaw.trim()
        : "";

  if (!UUID_REGEX.test(countryId)) {
    return NextResponse.json(
      { ok: false, error: "country_id must be a valid UUID." },
      { status: 400 },
    );
  }
  if (stateId !== null && stateId !== "" && !UUID_REGEX.test(stateId)) {
    return NextResponse.json(
      { ok: false, error: "state_id must be a valid UUID." },
      { status: 400 },
    );
  }

  try {
    const city = await createCityAdmin({
      name,
      country_id: countryId,
      state_id: stateId === "" ? null : stateId,
    });
    return NextResponse.json({ ok: true, city }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const code =
      error instanceof Error && "code" in error
        ? (error as Error & { code?: string }).code
        : undefined;
    const existingCity =
      error instanceof Error && "existingCity" in error
        ? (error as Error & { existingCity?: unknown }).existingCity
        : undefined;

    if (code === "DUPLICATE_CITY") {
      return NextResponse.json(
        { ok: false, error: message, existingCity },
        { status: 409 },
      );
    }

    const status = message.includes("required") || message.includes("Select a state") ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
