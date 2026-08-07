import { NextResponse } from "next/server";

import {
  addRelatedCompanyForAdmin,
  CompanyRelatedAdminError,
  listRelatedCompaniesForAdmin,
} from "@/src/features/companies/server/companyRelatedAdmin";
import {
  getCompanyAdminById,
  isCompanyAdminEditable,
  MERGED_COMPANY_READ_ONLY_MESSAGE,
} from "@/src/features/companies/server/companyAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

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

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  let body: { related_company_id?: string };
  try {
    body = (await request.json()) as { related_company_id?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const relatedCompanyId =
    typeof body.related_company_id === "string" ? body.related_company_id.trim() : "";
  if (relatedCompanyId === "") {
    return NextResponse.json(
      { ok: false, error: "related_company_id is required." },
      { status: 400 },
    );
  }

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

    const result = await addRelatedCompanyForAdmin(id, relatedCompanyId);
    const related = await listRelatedCompaniesForAdmin(id);

    return NextResponse.json({
      ok: true,
      result,
      related,
    });
  } catch (error) {
    if (error instanceof CompanyRelatedAdminError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
