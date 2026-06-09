import { NextResponse } from "next/server";

import { listCompaniesAdmin } from "@/src/features/companies/server/companyAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? undefined;

  try {
    const companies = await listCompaniesAdmin(search);
    return NextResponse.json({ ok: true, companies });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
