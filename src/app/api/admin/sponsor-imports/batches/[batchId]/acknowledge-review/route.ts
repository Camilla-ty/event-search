import { NextResponse } from "next/server";

import { sponsorImportErrorResponse } from "@/src/features/sponsor-import/server/apiResponse";
import { acknowledgeReview } from "@/src/features/sponsor-import/server/sponsorImportAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

type RouteContext = { params: Promise<{ batchId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { batchId } = await context.params;

  try {
    const batch = await acknowledgeReview(batchId, auth.context.userId);
    return NextResponse.json({ ok: true, batch });
  } catch (error) {
    return sponsorImportErrorResponse(error);
  }
}
