import { NextResponse } from "next/server";

import { partnerAlumniImportErrorResponse } from "@/src/features/partner-alumni-import/server/apiResponse";
import { partnerAlumniMaterializeChunkResponse } from "@/src/features/partner-alumni-import/server/materializeChunkApiResponse";
import { runMaterializeVersionMembersChunk } from "@/src/features/partner-alumni-import/server/materializePipeline";
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

  let body: Record<string, unknown> = {};
  try {
    const text = await request.text();
    if (text.trim()) {
      body = JSON.parse(text) as Record<string, unknown>;
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const cursor = typeof body.cursor === "number" ? body.cursor : undefined;
  const limit = typeof body.limit === "number" ? body.limit : undefined;

  try {
    const result = await runMaterializeVersionMembersChunk(
      params.batchId,
      scope,
      auth.context.userId,
      { cursor, limit },
    );
    return NextResponse.json(partnerAlumniMaterializeChunkResponse(result));
  } catch (error) {
    return partnerAlumniImportErrorResponse(error);
  }
}
