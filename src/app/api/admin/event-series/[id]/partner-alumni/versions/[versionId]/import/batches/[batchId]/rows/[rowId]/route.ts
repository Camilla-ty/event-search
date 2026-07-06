import { NextResponse } from "next/server";

import { partnerAlumniImportErrorResponse } from "@/src/features/partner-alumni-import/server/apiResponse";
import {
  getBatchRowById,
  patchRowDecision,
} from "@/src/features/partner-alumni-import/server/partnerAlumniImportAdmin";
import { importScopeFromParams } from "@/src/features/partner-alumni-import/server/routeScope";
import type { PartnerAlumniImportDecisionType } from "@/src/features/partner-alumni-import/types";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

type RouteContext = {
  params: Promise<{ id: string; versionId: string; batchId: string; rowId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const params = await context.params;
  const scope = importScopeFromParams(params);

  try {
    const row = await getBatchRowById(params.batchId, scope, params.rowId);
    return NextResponse.json({ ok: true, row });
  } catch (error) {
    return partnerAlumniImportErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const params = await context.params;
  const scope = importScopeFromParams(params);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const decisionType = body.decision_type;
  if (
    decisionType !== "use_matched" &&
    decisionType !== "create_new" &&
    decisionType !== "choose_different" &&
    decisionType !== "exclude"
  ) {
    return NextResponse.json({ ok: false, error: "Invalid decision_type." }, { status: 400 });
  }

  try {
    const row = await patchRowDecision(params.batchId, scope, params.rowId, auth.context.userId, {
      decision_type: decisionType as PartnerAlumniImportDecisionType,
      resolved_company_id:
        typeof body.resolved_company_id === "string" ? body.resolved_company_id : null,
      decision_notes: typeof body.decision_notes === "string" ? body.decision_notes : null,
      duplicate_resolution:
        body.duplicate_resolution === "kept" ||
        body.duplicate_resolution === "excluded" ||
        body.duplicate_resolution === "pending"
          ? body.duplicate_resolution
          : undefined,
    });
    return NextResponse.json({ ok: true, row });
  } catch (error) {
    return partnerAlumniImportErrorResponse(error);
  }
}
