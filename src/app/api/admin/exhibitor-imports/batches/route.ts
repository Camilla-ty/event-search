import { NextResponse } from "next/server";

import { exhibitorImportErrorResponse } from "@/src/features/exhibitor-import/server/apiResponse";
import {
  createBatchFromUpload,
  listBatchesAdmin,
  parseColumnMapping,
} from "@/src/features/exhibitor-import/server/exhibitorImportAdmin";
import type { ExhibitorImportBatchStatus } from "@/src/features/exhibitor-import/types";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const editionId = searchParams.get("editionId") ?? undefined;
  const status = searchParams.get("status") as ExhibitorImportBatchStatus | null;
  const limit = Number(searchParams.get("limit") ?? "50");
  const offset = Number(searchParams.get("offset") ?? "0");

  try {
    const result = await listBatchesAdmin({
      editionId,
      status: status ?? undefined,
      limit: Number.isFinite(limit) ? limit : 50,
      offset: Number.isFinite(offset) ? offset : 0,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return exhibitorImportErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const form = await request.formData();
    const eventEditionId = form.get("event_edition_id");
    const file = form.get("file");

    if (typeof eventEditionId !== "string" || !eventEditionId.trim()) {
      return NextResponse.json(
        { ok: false, error: "event_edition_id is required." },
        { status: 400 },
      );
    }

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
      actorId: auth.context.userId,
      eventEditionId: eventEditionId.trim(),
      filename: file.name,
      mimeType: file.type,
      fileBytes: bytes,
      columnMapping,
    });

    return NextResponse.json({ ok: true, batch: result.batch, rowCount: result.rowCount });
  } catch (error) {
    return exhibitorImportErrorResponse(error);
  }
}
