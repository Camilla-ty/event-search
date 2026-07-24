import { NextResponse } from "next/server";

import { exhibitorImportErrorResponse } from "@/src/features/exhibitor-import/server/apiResponse";
import { bulkApplyRowDecisions } from "@/src/features/exhibitor-import/server/exhibitorImportAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

type RouteContext = { params: Promise<{ batchId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { batchId } = await context.params;

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

  const rowIdsRaw = body.row_ids;
  if (!Array.isArray(rowIdsRaw)) {
    return NextResponse.json({ ok: false, error: "row_ids must be an array." }, { status: 400 });
  }

  const row_ids = rowIdsRaw.filter((id): id is string => typeof id === "string");

  try {
    const result = await bulkApplyRowDecisions(batchId, auth.context.userId, {
      decision_type: decisionType,
      row_ids,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return exhibitorImportErrorResponse(error);
  }
}
