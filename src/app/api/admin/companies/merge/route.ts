import { NextResponse } from "next/server";

import {
  CompanyMergeAdminHttpError,
  executeMergeCompaniesAdmin,
} from "@/src/features/companies/server/companyMergeAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

type MergeCompaniesPostBody = {
  canonical_company_id?: unknown;
  duplicate_company_id?: unknown;
  resolutions?: unknown;
  confirmation?: unknown;
  notes?: unknown;
};

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let body: MergeCompaniesPostBody;
  try {
    body = (await request.json()) as MergeCompaniesPostBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  try {
    const result = await executeMergeCompaniesAdmin({
      canonicalCompanyId:
        typeof body.canonical_company_id === "string" ? body.canonical_company_id : "",
      duplicateCompanyId:
        typeof body.duplicate_company_id === "string" ? body.duplicate_company_id : "",
      performedBy: auth.context.userId,
      confirmation: typeof body.confirmation === "string" ? body.confirmation : "",
      resolutions: body.resolutions ?? null,
      notes: typeof body.notes === "string" ? body.notes : null,
    });

    return NextResponse.json({
      ok: true,
      merge_id: result.merge_id,
      canonical_company_id: result.canonical_company_id,
      duplicate_company_id: result.duplicate_company_id,
      preview_snapshot: result.preview_snapshot,
      execution_snapshot: result.execution_snapshot,
      redirect_to: result.redirect_to,
    });
  } catch (error) {
    if (error instanceof CompanyMergeAdminHttpError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status },
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
