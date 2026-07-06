import { NextResponse } from "next/server";

import { partnerAlumniImportErrorResponse } from "@/src/features/partner-alumni-import/server/apiResponse";
import { listBatchRows } from "@/src/features/partner-alumni-import/server/partnerAlumniImportAdmin";
import { importScopeFromParams } from "@/src/features/partner-alumni-import/server/routeScope";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

type RouteContext = {
  params: Promise<{ id: string; versionId: string; batchId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const params = await context.params;
  const scope = importScopeFromParams(params);
  const { searchParams } = new URL(request.url);

  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "50");

  try {
    const result = await listBatchRows(params.batchId, scope, {
      status: searchParams.get("status") ?? undefined,
      hasBlockingValidation:
        searchParams.get("hasBlockingValidation") === "true"
          ? true
          : searchParams.get("hasBlockingValidation") === "false"
            ? false
            : undefined,
      duplicateResolution: searchParams.get("duplicateResolution") ?? undefined,
      duplicateClusterKey: searchParams.get("duplicateClusterKey") ?? undefined,
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 50,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return partnerAlumniImportErrorResponse(error);
  }
}
