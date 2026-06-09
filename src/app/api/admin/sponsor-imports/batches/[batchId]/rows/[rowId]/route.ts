import { NextResponse } from "next/server";

import { sponsorImportErrorResponse } from "@/src/features/sponsor-import/server/apiResponse";
import {
  getBatchRowById,
  patchRowDecision,
} from "@/src/features/sponsor-import/server/sponsorImportAdmin";
import type { SponsorImportDecisionType } from "@/src/features/sponsor-import/types";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

type RouteContext = { params: Promise<{ batchId: string; rowId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { batchId, rowId } = await context.params;

  try {
    const row = await getBatchRowById(batchId, rowId);
    return NextResponse.json({ ok: true, row });
  } catch (error) {
    return sponsorImportErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { batchId, rowId } = await context.params;

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
    const row = await patchRowDecision(batchId, rowId, auth.context.userId, {
      decision_type: decisionType as SponsorImportDecisionType,
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
    return sponsorImportErrorResponse(error);
  }
}
