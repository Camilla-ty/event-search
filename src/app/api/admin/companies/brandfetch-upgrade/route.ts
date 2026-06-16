import { NextResponse } from "next/server";

import {
  BRANDFETCH_UPGRADE_MAX_BATCH_SIZE,
  upgradeCompaniesWithBrandfetchLogo,
} from "@/src/features/companies/server/brandfetchLogoUpgrade";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const companyIdsRaw = body.company_ids;
  if (!Array.isArray(companyIdsRaw)) {
    return NextResponse.json(
      { ok: false, error: "company_ids must be an array." },
      { status: 400 },
    );
  }

  const company_ids = companyIdsRaw.filter((id): id is string => typeof id === "string");

  if (company_ids.length === 0) {
    return NextResponse.json(
      { ok: false, error: "company_ids must not be empty." },
      { status: 400 },
    );
  }

  if (company_ids.length > BRANDFETCH_UPGRADE_MAX_BATCH_SIZE) {
    return NextResponse.json(
      {
        ok: false,
        error: `At most ${BRANDFETCH_UPGRADE_MAX_BATCH_SIZE} companies per request.`,
      },
      { status: 400 },
    );
  }

  try {
    const result = await upgradeCompaniesWithBrandfetchLogo(company_ids);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      message.includes("BRANDFETCH_API_KEY") || message.includes("not configured") ? 503 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
