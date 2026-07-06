import { NextResponse } from "next/server";

import { partnerAlumniImportErrorResponse } from "@/src/features/partner-alumni-import/server/apiResponse";
import { acknowledgeCreateNew } from "@/src/features/partner-alumni-import/server/materializePipeline";
import { importScopeFromParams } from "@/src/features/partner-alumni-import/server/routeScope";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

type RouteContext = {
  params: Promise<{ id: string; versionId: string; batchId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const params = await context.params;
  const scope = importScopeFromParams(params);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const count = body.count;
  if (typeof count !== "number") {
    return NextResponse.json({ ok: false, error: "count is required." }, { status: 400 });
  }

  try {
    const batch = await acknowledgeCreateNew(
      params.batchId,
      scope,
      auth.context.userId,
      count,
    );
    return NextResponse.json({ ok: true, batch });
  } catch (error) {
    return partnerAlumniImportErrorResponse(error);
  }
}
