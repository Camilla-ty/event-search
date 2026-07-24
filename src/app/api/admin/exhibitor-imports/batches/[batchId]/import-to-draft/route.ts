import { NextResponse } from "next/server";

import { exhibitorImportErrorResponse } from "@/src/features/exhibitor-import/server/apiResponse";
import { importBatchToDraft } from "@/src/features/exhibitor-import/server/exhibitorImportAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

export const maxDuration = 300;

type RouteContext = { params: Promise<{ batchId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { batchId } = await context.params;

  try {
    const result = await importBatchToDraft(batchId, auth.context.userId);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return exhibitorImportErrorResponse(error);
  }
}
