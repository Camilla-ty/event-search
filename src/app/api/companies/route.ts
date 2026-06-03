import { NextResponse, after } from "next/server";

import {
  createCompany,
  enrichCompanyLogo,
} from "@/src/features/companies/server/createCompanyWithLogo";
import { getProfileRoleForUserId, isAdminRole } from "@/src/lib/auth/appProfile";
import { createClient } from "@/src/lib/supabase/server";

type CreateCompanyBody = {
  name?: string;
  website?: string;
  city_id?: string | null;
  slug?: string;
};

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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

  let body: CreateCompanyBody;
  try {
    body = (await request.json()) as CreateCompanyBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  const name = body.name?.trim();
  const website = body.website?.trim();
  const cityId =
    typeof body.city_id === "string" && body.city_id.trim() !== ""
      ? body.city_id.trim()
      : null;
  const rawSlug = body.slug?.trim() ?? "";
  const slug = slugify(rawSlug !== "" ? rawSlug : name ?? "");

  if (!name || !website || !slug) {
    return NextResponse.json(
      { ok: false, error: "name, website, and valid slug are required." },
      { status: 400 },
    );
  }

  try {
    const company = await createCompany({
      name,
      website,
      city_id: cityId,
      slug,
    });

    after(async () => {
      await enrichCompanyLogo(company.id, website);
    });

    return NextResponse.json({ ok: true, company }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[api/companies] createCompany failed", { message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
