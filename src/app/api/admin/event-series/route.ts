import { NextResponse } from "next/server";

import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";
import { slugify } from "@/src/lib/slugify";
import { isValidHttpUrl } from "@/src/lib/validation/url";
import {
  createEventSeries,
  listEventSeriesAdmin,
} from "@/src/features/events/server/eventSeriesAdmin";

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? undefined;

  try {
    const series = await listEventSeriesAdmin(search);
    return NextResponse.json({ ok: true, series });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

type CreateSeriesBody = {
  name?: string;
  slug?: string;
  description?: string | null;
  website_url?: string | null;
  logo_url?: string | null;
};

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let body: CreateSeriesBody;
  try {
    body = (await request.json()) as CreateSeriesBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  const slug = slugify(body.slug?.trim() || name);
  const errors: string[] = [];

  if (!name) errors.push("name is required");
  if (!slug) errors.push("slug is required");

  const website = body.website_url?.trim() || null;
  const logo = body.logo_url?.trim() || null;
  if (website && !isValidHttpUrl(website)) errors.push("website_url must be a valid URL");
  if (logo && !isValidHttpUrl(logo)) errors.push("logo_url must be a valid URL");

  if (errors.length > 0) {
    return NextResponse.json({ ok: false, error: errors.join("; ") }, { status: 400 });
  }

  try {
    const series = await createEventSeries({
      name,
      slug,
      description: body.description ?? null,
      website_url: website,
      logo_url: logo,
    });
    return NextResponse.json({ ok: true, series }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
