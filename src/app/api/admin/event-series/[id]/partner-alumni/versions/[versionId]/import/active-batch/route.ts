import { NextResponse } from "next/server";

import { partnerAlumniImportErrorResponse } from "@/src/features/partner-alumni-import/server/apiResponse";
import { getActiveBatchForVersion } from "@/src/features/partner-alumni-import/server/partnerAlumniImportAdmin";
import { importScopeFromParams } from "@/src/features/partner-alumni-import/server/routeScope";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

type RouteContext = { params: Promise<{ id: string; versionId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const params = await context.params;
  const scope = importScopeFromParams(params);

  try {
    const batch = await getActiveBatchForVersion(scope);
    return NextResponse.json({ ok: true, batch });
  } catch (error) {
    return partnerAlumniImportErrorResponse(error);
  }
}
