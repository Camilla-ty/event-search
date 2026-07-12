import { NextResponse } from "next/server";

import { buildAdminCompaniesCollection } from "@/src/features/companies/server/adminCompaniesCollection";
import { parseCompaniesListParams } from "@/src/features/companies/server/companiesListParams";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const params = parseCompaniesListParams(searchParams);

  try {
    const result = await buildAdminCompaniesCollection(params);
    return NextResponse.json({
      ok: true,
      companies: result.companies,
      total: result.total,
      params: result.params,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
