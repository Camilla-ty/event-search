import { NextResponse } from "next/server";

import { sponsorImportErrorResponse } from "@/src/features/sponsor-import/server/apiResponse";
import { discardBatch } from "@/src/features/sponsor-import/server/sponsorImportAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

type RouteContext = { params: Promise<{ batchId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { batchId } = await context.params;

  try {
    const result = await discardBatch(batchId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return sponsorImportErrorResponse(error);
  }
}
