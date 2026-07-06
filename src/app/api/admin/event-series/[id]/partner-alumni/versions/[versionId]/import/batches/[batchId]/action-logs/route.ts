import { NextResponse } from "next/server";

import { partnerAlumniImportErrorResponse } from "@/src/features/partner-alumni-import/server/apiResponse";
import { listActionLogs } from "@/src/features/partner-alumni-import/server/partnerAlumniImportAdmin";
import { importScopeFromParams } from "@/src/features/partner-alumni-import/server/routeScope";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

type RouteContext = {
  params: Promise<{ id: string; versionId: string; batchId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const params = await context.params;
  const scope = importScopeFromParams(params);

  try {
    const logs = await listActionLogs(params.batchId, scope);
    return NextResponse.json({ ok: true, logs });
  } catch (error) {
    return partnerAlumniImportErrorResponse(error);
  }
}
