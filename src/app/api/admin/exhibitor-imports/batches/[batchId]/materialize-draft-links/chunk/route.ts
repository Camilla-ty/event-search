import { NextResponse } from "next/server";

import { exhibitorImportErrorResponse } from "@/src/features/exhibitor-import/server/apiResponse";
import { runMaterializeDraftLinksChunk } from "@/src/features/exhibitor-import/server/exhibitorImportAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

export const maxDuration = 300;

type RouteContext = { params: Promise<{ batchId: string }> };

type ChunkBody = {
  cursor?: number;
  limit?: number;
};

function parseChunkBody(raw: unknown): ChunkBody {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const body = raw as Record<string, unknown>;
  const cursor =
    typeof body.cursor === "number" && Number.isFinite(body.cursor) && body.cursor >= 0
      ? Math.floor(body.cursor)
      : undefined;
  const limit =
    typeof body.limit === "number" && Number.isFinite(body.limit) && body.limit > 0
      ? Math.floor(body.limit)
      : undefined;
  return { cursor, limit };
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { batchId } = await context.params;

  let body: ChunkBody = {};
  try {
    body = parseChunkBody(await request.json());
  } catch {
    body = {};
  }

  try {
    const result = await runMaterializeDraftLinksChunk(batchId, auth.context.userId, body);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return exhibitorImportErrorResponse(error);
  }
}
