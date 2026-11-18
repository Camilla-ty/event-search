import { NextResponse } from "next/server";

import { sponsorImportErrorResponse } from "@/src/features/sponsor-import/server/apiResponse";
import { runBatchMatching } from "@/src/features/sponsor-import/server/sponsorImportAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

type RouteContext = { params: Promise<{ batchId: string }> };

/** Align with materialize/import-to-draft; large batches can exceed the platform default. */
export const maxDuration = 300;

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { batchId } = await context.params;

  let force = false;
  try {
    const body = (await request.json()) as { force?: unknown };
    force = body?.force === true;
  } catch {
    // Empty or non-JSON body: treat as a normal (non-force) match request.
  }

  try {
    const result = await runBatchMatching(batchId, auth.context.userId, { force });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return sponsorImportErrorResponse(error);
  }
}
