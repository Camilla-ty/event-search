import { NextResponse } from "next/server";

import {
  getCompanyAdminById,
  isCompanyAdminEditable,
  MERGED_COMPANY_READ_ONLY_MESSAGE,
} from "@/src/features/companies/server/companyAdmin";
import {
  CompanyDomainAdminError,
  listCompanyDomainsForAdmin,
  setCompanyPrimaryDomainForAdmin,
} from "@/src/features/companies/server/companyDomainsAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

type RouteContext = { params: Promise<{ id: string; domainId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id, domainId } = await context.params;

  try {
    const company = await getCompanyAdminById(id);
    if (!company) {
      return NextResponse.json({ ok: false, error: "Company not found." }, { status: 404 });
    }
    if (!isCompanyAdminEditable(company)) {
      return NextResponse.json({ ok: false, error: MERGED_COMPANY_READ_ONLY_MESSAGE }, { status: 409 });
    }

    const result = await setCompanyPrimaryDomainForAdmin(id, domainId);
    const domains = await listCompanyDomainsForAdmin(id);

    return NextResponse.json({
      ok: true,
      result,
      domains,
    });
  } catch (error) {
    if (error instanceof CompanyDomainAdminError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
