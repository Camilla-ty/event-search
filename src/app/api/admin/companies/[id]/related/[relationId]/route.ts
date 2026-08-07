import { NextResponse } from "next/server";

import {
  CompanyRelatedAdminError,
  listRelatedCompaniesForAdmin,
  removeRelatedCompanyForAdmin,
} from "@/src/features/companies/server/companyRelatedAdmin";
import {
  getCompanyAdminById,
  isCompanyAdminEditable,
  MERGED_COMPANY_READ_ONLY_MESSAGE,
} from "@/src/features/companies/server/companyAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

type RouteContext = { params: Promise<{ id: string; relationId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id, relationId } = await context.params;

  try {
    const company = await getCompanyAdminById(id);
    if (!company) {
      return NextResponse.json({ ok: false, error: "Company not found." }, { status: 404 });
    }
    if (!isCompanyAdminEditable(company)) {
      return NextResponse.json(
        { ok: false, error: MERGED_COMPANY_READ_ONLY_MESSAGE },
        { status: 409 },
      );
    }

    await removeRelatedCompanyForAdmin(id, relationId);
    const related = await listRelatedCompaniesForAdmin(id);

    return NextResponse.json({ ok: true, related });
  } catch (error) {
    if (error instanceof CompanyRelatedAdminError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
