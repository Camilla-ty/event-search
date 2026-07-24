import { NextResponse } from "next/server";

import { exhibitorImportErrorResponse } from "@/src/features/exhibitor-import/server/apiResponse";
import { getBatchAdmin } from "@/src/features/exhibitor-import/server/exhibitorImportAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

type RouteContext = { params: Promise<{ batchId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { batchId } = await context.params;

  try {
    const result = await getBatchAdmin(batchId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return exhibitorImportErrorResponse(error);
  }
}
