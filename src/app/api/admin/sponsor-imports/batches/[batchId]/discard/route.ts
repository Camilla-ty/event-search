import { NextResponse } from "next/server";

import { sponsorImportErrorResponse } from "@/src/features/sponsor-import/server/apiResponse";
import { discardBatch } from "@/src/features/sponsor-import/server/sponsorImportAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

type RouteContext = { params: Promise<{ batchId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { batchId } = await context.params;

  let discardReason: string | null = null;
  try {
    const body = (await request.json()) as { discard_reason?: string };
    discardReason = typeof body.discard_reason === "string" ? body.discard_reason : null;
  } catch {
    discardReason = null;
  }

  try {
    const batch = await discardBatch(batchId, auth.context.userId, discardReason);
    return NextResponse.json({ ok: true, batch });
  } catch (error) {
    return sponsorImportErrorResponse(error);
  }
}
