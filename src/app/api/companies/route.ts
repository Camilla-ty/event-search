import { NextResponse, after } from "next/server";

import {
  createCompany,
  enrichCompanyLogo,
} from "@/src/features/companies/server/createCompanyWithLogo";
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
  const requestId = crypto.randomUUID();
  console.info("[api/companies] request received", { requestId });

  // Authentication boundary: every write goes through `getUser()` first. The
  // service-role client is intentionally only used by helpers (e.g. `createCompany`)
  // AFTER we've confirmed the caller is authenticated.
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    console.warn("[api/companies] unauthorized", {
      requestId,
      reason: authError?.message ?? "no_user",
    });
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  let body: CreateCompanyBody;
  try {
    body = (await request.json()) as CreateCompanyBody;
    console.info("[api/companies] payload parsed", {
      requestId,
      hasName: Boolean(body.name),
      hasWebsite: Boolean(body.website),
      hasCityId: Boolean(body.city_id),
      hasSlug: Boolean(body.slug),
    });
  } catch {
    console.error("[api/companies] invalid json payload", { requestId });
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
    console.error("[api/companies] validation failed", {
      requestId,
      namePresent: Boolean(name),
      websitePresent: Boolean(website),
      cityProvided: cityId !== null,
      slugPresent: Boolean(slug),
    });
    return NextResponse.json(
      { ok: false, error: "name, website, and valid slug are required." },
      { status: 400 },
    );
  }

  try {
    console.info("[api/companies] createCompany start", {
      requestId,
      name,
      website,
      cityId,
      slug,
    });
    const company = await createCompany({
      name,
      website,
      city_id: cityId,
      slug,
    });
    console.info("[api/companies] createCompany success", {
      requestId,
      companyId: company.id,
      domain: company.domain,
    });

    after(async () => {
      console.info("[api/companies] scheduling logo enrichment", {
        requestId,
        companyId: company.id,
      });
      await enrichCompanyLogo(company.id, website);
    });

    return NextResponse.json({ ok: true, company }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[api/companies] createCompany failed", {
      requestId,
      message,
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
