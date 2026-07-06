import { NextResponse } from "next/server";

import { partnerAlumniImportErrorResponse } from "@/src/features/partner-alumni-import/server/apiResponse";
import {
  createBatchFromUpload,
  listBatchesAdmin,
  parseColumnMapping,
} from "@/src/features/partner-alumni-import/server/partnerAlumniImportAdmin";
import { importScopeFromParams } from "@/src/features/partner-alumni-import/server/routeScope";
import type { PartnerAlumniImportBatchStatus } from "@/src/features/partner-alumni-import/types";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

type RouteContext = { params: Promise<{ id: string; versionId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const params = await context.params;
  const scope = importScopeFromParams(params);
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as PartnerAlumniImportBatchStatus | null;
  const limit = Number(searchParams.get("limit") ?? "50");
  const offset = Number(searchParams.get("offset") ?? "0");

  try {
    const result = await listBatchesAdmin(scope, {
      status: status ?? undefined,
      limit: Number.isFinite(limit) ? limit : 50,
      offset: Number.isFinite(offset) ? offset : 0,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return partnerAlumniImportErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const params = await context.params;
  const scope = importScopeFromParams(params);

  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "file is required." }, { status: 400 });
    }

    let columnMapping = null;
    const mappingRaw = form.get("column_mapping");
    if (typeof mappingRaw === "string" && mappingRaw.trim()) {
      columnMapping = parseColumnMapping(JSON.parse(mappingRaw) as unknown);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await createBatchFromUpload({
      scope,
      actorId: auth.context.userId,
      filename: file.name,
      mimeType: file.type,
      fileBytes: bytes,
      columnMapping,
    });

    return NextResponse.json({ ok: true, batch: result.batch, rowCount: result.rowCount });
  } catch (error) {
    return partnerAlumniImportErrorResponse(error);
  }
}
