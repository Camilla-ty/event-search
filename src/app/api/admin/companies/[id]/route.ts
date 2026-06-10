import { NextResponse, after } from "next/server";

import {
  getCompanyAdminById,
  updateCompanyAdmin,
} from "@/src/features/companies/server/companyAdmin";
import { enrichCompanyLogo } from "@/src/features/companies/server/createCompanyWithLogo";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";
import { slugify } from "@/src/lib/slugify";
import { isValidHttpUrl } from "@/src/lib/validation/url";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  try {
    const company = await getCompanyAdminById(id);
    if (!company) {
      return NextResponse.json({ ok: false, error: "Company not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, company });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

type PatchCompanyBody = {
  name?: string;
  slug?: string;
  website?: string;
  logo_url?: string | null;
  short_description?: string | null;
  description?: string | null;
  city_id?: string | null;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  let body: PatchCompanyBody;
  try {
    body = (await request.json()) as PatchCompanyBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const errors: string[] = [];
  const patch: PatchCompanyBody = {};

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) errors.push("name cannot be empty");
    else patch.name = name;
  }
  if (body.slug !== undefined) {
    const slug = slugify(body.slug.trim());
    if (!slug) errors.push("slug cannot be empty");
    else patch.slug = slug;
  }
  if (body.website !== undefined) {
    const website = body.website.trim();
    if (!website) errors.push("website is required");
    else if (!isValidHttpUrl(website)) errors.push("website must be a valid URL");
    else patch.website = website;
  }
  if (body.logo_url !== undefined) {
    const logo = body.logo_url?.trim() || null;
    if (logo && !isValidHttpUrl(logo)) errors.push("logo_url must be a valid URL");
    else patch.logo_url = logo;
  }
  if (body.short_description !== undefined) patch.short_description = body.short_description;
  if (body.description !== undefined) patch.description = body.description;
  if (body.city_id !== undefined) {
    patch.city_id =
      typeof body.city_id === "string" && body.city_id.trim() !== ""
        ? body.city_id.trim()
        : null;
  }

  if (errors.length > 0) {
    return NextResponse.json({ ok: false, error: errors.join("; ") }, { status: 400 });
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "No fields to update." }, { status: 400 });
  }

  try {
    const company = await updateCompanyAdmin(id, patch);

    if (typeof patch.website === "string") {
      after(async () => {
        await enrichCompanyLogo(id, patch.website as string);
      });
    }

    return NextResponse.json({ ok: true, company });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
