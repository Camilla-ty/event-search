import { NextResponse } from "next/server";

import {
  getCompanyAdminById,
  isCompanyAdminEditable,
  MERGED_COMPANY_READ_ONLY_MESSAGE,
} from "@/src/features/companies/server/companyAdmin";
import {
  CompanyDomainAdminError,
  updateCompanyDomainNoteForAdmin,
} from "@/src/features/companies/server/companyDomainsAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

type RouteContext = { params: Promise<{ id: string; domainId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id, domainId } = await context.params;

  let body: { note?: string | null };
  try {
    body = (await request.json()) as { note?: string | null };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!("note" in body)) {
    return NextResponse.json({ ok: false, error: "note is required." }, { status: 400 });
  }

  const note = typeof body.note === "string" || body.note === null ? body.note : undefined;
  if (note === undefined) {
    return NextResponse.json({ ok: false, error: "note must be a string or null." }, { status: 400 });
  }

  try {
    const company = await getCompanyAdminById(id);
    if (!company) {
      return NextResponse.json({ ok: false, error: "Company not found." }, { status: 404 });
    }
    if (!isCompanyAdminEditable(company)) {
      return NextResponse.json({ ok: false, error: MERGED_COMPANY_READ_ONLY_MESSAGE }, { status: 409 });
    }

    const domain = await updateCompanyDomainNoteForAdmin(id, domainId, note);

    return NextResponse.json({ ok: true, domain });
  } catch (error) {
    if (error instanceof CompanyDomainAdminError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
