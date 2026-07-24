import { NextResponse } from "next/server";

import { exhibitorImportErrorResponse } from "@/src/features/exhibitor-import/server/apiResponse";
import { listActionLogs } from "@/src/features/exhibitor-import/server/exhibitorImportAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

type RouteContext = { params: Promise<{ batchId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { batchId } = await context.params;

  try {
    const logs = await listActionLogs(batchId);
    return NextResponse.json({ ok: true, logs });
  } catch (error) {
    return exhibitorImportErrorResponse(error);
  }
}
