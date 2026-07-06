import { NextResponse } from "next/server";

import { partnerAlumniImportErrorResponse } from "@/src/features/partner-alumni-import/server/apiResponse";
import { bulkApplyRowDecisions } from "@/src/features/partner-alumni-import/server/partnerAlumniImportAdmin";
import { importScopeFromParams } from "@/src/features/partner-alumni-import/server/routeScope";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

type RouteContext = {
  params: Promise<{ id: string; versionId: string; batchId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
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
  if (decisionType !== "create_new" && decisionType !== "exclude") {
    return NextResponse.json({ ok: false, error: "Invalid decision_type." }, { status: 400 });
  }

  const rowIds = Array.isArray(body.row_ids)
    ? body.row_ids.filter((id): id is string => typeof id === "string")
    : [];

  try {
    const result = await bulkApplyRowDecisions(
      params.batchId,
      scope,
      auth.context.userId,
      {
        decision_type: decisionType,
        row_ids: rowIds,
      },
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return partnerAlumniImportErrorResponse(error);
  }
}
