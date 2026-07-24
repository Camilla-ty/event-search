import { NextResponse } from "next/server";

import { exhibitorImportErrorResponse } from "@/src/features/exhibitor-import/server/apiResponse";
import { buildOutcomeReportCsv } from "@/src/features/exhibitor-import/server/exhibitorImportAdmin";
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
        "Content-Disposition": `attachment; filename="exhibitor-import-${batchId}.csv"`,
      },
    });
  } catch (error) {
    return exhibitorImportErrorResponse(error);
  }
}
