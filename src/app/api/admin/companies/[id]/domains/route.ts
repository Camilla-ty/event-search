import { NextResponse } from "next/server";

import {
  addCompanyDomainForAdmin,
  listCompanyDomainsForAdmin,
} from "@/src/features/companies/server/companyDomainsAdmin";
import {
  getCompanyAdminById,
  isCompanyAdminEditable,
  MERGED_COMPANY_READ_ONLY_MESSAGE,
} from "@/src/features/companies/server/companyAdmin";
import { CompanyDomainLinkError } from "@/src/lib/companies/linkCompanyDomainFromImport";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  let body: { domain?: string };
  try {
    body = (await request.json()) as { domain?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const rawDomain = typeof body.domain === "string" ? body.domain : "";
  if (rawDomain.trim() === "") {
    return NextResponse.json({ ok: false, error: "Domain is required." }, { status: 400 });
  }

  try {
    const company = await getCompanyAdminById(id);
    if (!company) {
      return NextResponse.json({ ok: false, error: "Company not found." }, { status: 404 });
    }
    if (!isCompanyAdminEditable(company)) {
      return NextResponse.json({ ok: false, error: MERGED_COMPANY_READ_ONLY_MESSAGE }, { status: 409 });
    }

    const result = await addCompanyDomainForAdmin(id, rawDomain);
    const domains = await listCompanyDomainsForAdmin(id);

    return NextResponse.json({
      ok: true,
      result,
      domains,
    });
  } catch (error) {
    if (error instanceof CompanyDomainLinkError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
