import { NextResponse } from "next/server";

import { partnerAlumniImportErrorResponse } from "@/src/features/partner-alumni-import/server/apiResponse";
import {
  buildOutcomeReportCsv,
  getImportCompletionSummary,
} from "@/src/features/partner-alumni-import/server/materializePipeline";
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
  const format = searchParams.get("format");

  try {
    if (format === "json") {
      const summary = await getImportCompletionSummary(params.batchId, scope);
      return NextResponse.json({ ok: true, summary });
    }

    const csv = await buildOutcomeReportCsv(params.batchId, scope);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="partner-alumni-import-${params.batchId}.csv"`,
      },
    });
  } catch (error) {
    return partnerAlumniImportErrorResponse(error);
  }
}
