import { NextResponse } from "next/server";

import { sponsorImportErrorResponse } from "@/src/features/sponsor-import/server/apiResponse";
import { buildOutcomeReportCsv } from "@/src/features/sponsor-import/server/sponsorImportAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

type RouteContext = { params: Promise<{ batchId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { batchId } = await context.params;

  try {
    const csv = await buildOutcomeReportCsv(batchId);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="sponsor-import-${batchId}.csv"`,
      },
    });
  } catch (error) {
    return sponsorImportErrorResponse(error);
  }
}
