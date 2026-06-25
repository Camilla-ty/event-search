import { NextResponse, after } from "next/server";

import { ingestManualCompanyLogoFromUrl } from "@/src/features/companies/server/companyLogoIngest";
import { scheduleCompanyLogoCleanupAfterPersist } from "@/src/features/companies/server/companyLogoStorage";
import {
  applyManualCompanyLogoStorage,
  createCompany,
  enrichCompanyLogo,
  normalizeDomainFromWebsite,
} from "@/src/features/companies/server/createCompanyWithLogo";
import { isUniqueViolation, uniqueViolationUserMessage } from "@/src/features/sponsor-import/server/errors";
import { getProfileRoleForUserId, isAdminRole } from "@/src/lib/auth/appProfile";
import { isCompanyLogoStorageUrl } from "@/src/lib/companies/isCompanyLogoStorageUrl";
import { MANUAL_LOGO_IMPORT_FAILED_WARNING } from "@/src/lib/companies/manualLogoIngestMessages";
import { createClient } from "@/src/lib/supabase/server";
import { isValidHttpUrl } from "@/src/lib/validation/url";

type CreateCompanyBody = {
  name?: string;
  website?: string;
  city_id?: string | null;
  slug?: string;
  logo_url?: string | null;
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
  const manualLogoUrl = body.logo_url?.trim() || null;

  if (!name || !website || !slug) {
    return NextResponse.json(
      { ok: false, error: "name, website, and valid slug are required." },
      { status: 400 },
    );
  }

  if (manualLogoUrl && !isValidHttpUrl(manualLogoUrl)) {
    return NextResponse.json(
      { ok: false, error: "logo_url must be a valid URL." },
      { status: 400 },
    );
  }

  try {
    let company = await createCompany({
      name,
      website,
      city_id: cityId,
      slug,
    });

    const warnings: string[] = [];
    let skipAutoEnrich = false;

    if (manualLogoUrl) {
      const domain = normalizeDomainFromWebsite(website);
      if (domain) {
        if (isCompanyLogoStorageUrl(manualLogoUrl)) {
          company = await applyManualCompanyLogoStorage(company.id, manualLogoUrl);
          skipAutoEnrich = true;
        } else {
          const ingest = await ingestManualCompanyLogoFromUrl(manualLogoUrl, company.id);
          if (ingest.ok) {
            company = await applyManualCompanyLogoStorage(company.id, ingest.storageUrl);
            scheduleCompanyLogoCleanupAfterPersist({
              companyId: company.id,
              publicUrl: ingest.storageUrl,
            });
            skipAutoEnrich = true;
          } else {
            warnings.push(MANUAL_LOGO_IMPORT_FAILED_WARNING);
          }
        }
      } else {
        warnings.push(MANUAL_LOGO_IMPORT_FAILED_WARNING);
      }
    }

    if (!skipAutoEnrich) {
      after(async () => {
        await enrichCompanyLogo(company.id, website);
      });
    }

    return NextResponse.json(
      {
        ok: true,
        company,
        ...(warnings.length > 0 ? { warnings } : {}),
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[api/companies] createCompany failed", { message });
    // Keep collision behavior consistent with the bulk-import path: a duplicate
    // name/slug/domain is a clean 409 with the shared user-facing message rather
    // than a leaked raw 500. (Social/community URLs resolve to a null domain and
    // never reach this path.)
    if (isUniqueViolation(message)) {
      return NextResponse.json(
        { ok: false, error: uniqueViolationUserMessage(message) },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
