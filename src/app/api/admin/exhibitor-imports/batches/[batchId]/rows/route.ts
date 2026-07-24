import { NextResponse } from "next/server";

import { exhibitorImportErrorResponse } from "@/src/features/exhibitor-import/server/apiResponse";
import { listBatchRows } from "@/src/features/exhibitor-import/server/exhibitorImportAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

type RouteContext = { params: Promise<{ batchId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { batchId } = await context.params;
  const { searchParams } = new URL(request.url);

  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "50");
  const hasBlocking = searchParams.get("hasBlockingValidation");
  let hasBlockingValidation: boolean | undefined;
  if (hasBlocking === "true") hasBlockingValidation = true;
  if (hasBlocking === "false") hasBlockingValidation = false;

  try {
    const result = await listBatchRows(batchId, {
      status: searchParams.get("status") ?? undefined,
      hasBlockingValidation,
      duplicateResolution: searchParams.get("duplicateResolution") ?? undefined,
      duplicateClusterKey: searchParams.get("duplicateClusterKey") ?? undefined,
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 50,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return exhibitorImportErrorResponse(error);
  }
}
