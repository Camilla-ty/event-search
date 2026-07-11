import { NextResponse } from "next/server";

import {
  CompanyRestrictionAdminError,
  restrictCompanyAdmin,
} from "@/src/features/companies/server/companyRestrictionAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  try {
    const result = await restrictCompanyAdmin(id);
    return NextResponse.json({ ok: true, company: result.company });
  } catch (error) {
    if (error instanceof CompanyRestrictionAdminError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
