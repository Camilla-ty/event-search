import { NextResponse } from "next/server";

import { createEventEdition } from "@/src/features/events/server/createEventEdition";
import { getProfileRoleForUserId, isAdminRole } from "@/src/lib/auth/appProfile";
import { createClient } from "@/src/lib/supabase/server";
import { buildEditionSlug } from "@/src/lib/slugify";
import { validateEditionCreateBody } from "@/src/lib/validation/eventEdition";

type CreateEventEditionBody = {
  series_id?: string;
  year?: number | string;
  name?: string;
  slug?: string;
  start_date?: string | null;
  end_date?: string | null;
  website_url?: string | null;
  city_id?: string | null;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  const role = await getProfileRoleForUserId(supabase, user.id);
  if (!isAdminRole(role)) {
    return NextResponse.json(
      { ok: false, error: "Forbidden." },
      { status: 403 },
    );
  }

  let body: CreateEventEditionBody;
  try {
    body = (await request.json()) as CreateEventEditionBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  const name = body.name?.trim() ?? "";
  const year = body.year;
  const derivedSlug =
    body.slug && body.slug.trim() !== ""
      ? body.slug.trim()
      : buildEditionSlug(name, Number(year));

  const validated = validateEditionCreateBody({
    series_id: body.series_id,
    year: body.year,
    name,
    slug: derivedSlug,
    start_date: body.start_date,
    end_date: body.end_date,
    website_url: body.website_url,
    city_id: body.city_id,
  });

  if (!validated.ok) {
    return NextResponse.json(
      { ok: false, error: validated.errors.join("; ") || "Invalid payload." },
      { status: 400 },
    );
  }

  try {
    const edition = await createEventEdition(validated.data);
    return NextResponse.json({ ok: true, edition }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[api/events] createEventEdition failed", { message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
