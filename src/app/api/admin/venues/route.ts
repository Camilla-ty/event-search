import { NextResponse } from "next/server";

import { buildAdminVenuesCollection } from "@/src/features/venues/server/adminVenuesCollection";
import { parseVenuesListParams } from "@/src/features/venues/server/venuesListParams";
import {
  createVenueAdmin,
  VenueAdminError,
} from "@/src/features/venues/server/venueAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";
import { slugify } from "@/src/lib/slugify";

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const params = parseVenuesListParams(searchParams);

  try {
    const result = await buildAdminVenuesCollection(params);
    return NextResponse.json({
      ok: true,
      venues: result.venues,
      total: result.total,
      params: result.params,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

type CreateVenueBody = {
  name?: string;
  slug?: string;
  city_id?: string;
  website_url?: string | null;
  address_text?: string | null;
  logo_url?: string | null;
};

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let body: CreateVenueBody;
  try {
    body = (await request.json()) as CreateVenueBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  const slug = slugify(body.slug?.trim() || name);

  try {
    const result = await createVenueAdmin({
      name,
      slug,
      city_id: body.city_id ?? "",
      website_url: body.website_url,
      address_text: body.address_text,
      logo_url: body.logo_url,
    });

    return NextResponse.json(
      {
        ok: true,
        venue: result.venue,
        ...(result.warnings.length > 0 ? { warnings: result.warnings } : {}),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof VenueAdminError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
