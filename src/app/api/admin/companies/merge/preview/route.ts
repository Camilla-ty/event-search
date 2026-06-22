import { NextResponse } from "next/server";

import {
  CompanyMergeAdminHttpError,
  previewMergeCompaniesAdmin,
} from "@/src/features/companies/server/companyMergeAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const canonicalRaw = searchParams.get("canonical");
  const duplicateRaw = searchParams.get("duplicate");

  try {
    const preview = await previewMergeCompaniesAdmin({
      canonicalCompanyId: canonicalRaw ?? "",
      duplicateCompanyId: duplicateRaw ?? "",
    });

    return NextResponse.json({ ok: true, preview });
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
