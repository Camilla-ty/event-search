import { NextResponse } from "next/server";

import { exhibitorImportErrorResponse } from "@/src/features/exhibitor-import/server/apiResponse";
import { patchDraftLink } from "@/src/features/exhibitor-import/server/exhibitorImportAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

type RouteContext = { params: Promise<{ batchId: string; linkId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { batchId, linkId } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const tierRaw = body.tier_rank;
  const tier_rank =
    typeof tierRaw === "number"
      ? tierRaw
      : typeof tierRaw === "string"
        ? Number(tierRaw)
        : undefined;

  try {
    const link = await patchDraftLink(batchId, linkId, {
      tier_rank: Number.isInteger(tier_rank) ? tier_rank : undefined,
      excluded_from_publish:
        typeof body.excluded_from_publish === "boolean"
          ? body.excluded_from_publish
          : undefined,
    });
    return NextResponse.json({ ok: true, link });
  } catch (error) {
    return exhibitorImportErrorResponse(error);
  }
}
