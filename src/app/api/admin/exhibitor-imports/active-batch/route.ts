import { NextResponse } from "next/server";

import { exhibitorImportErrorResponse } from "@/src/features/exhibitor-import/server/apiResponse";
import { getActiveBatchForEdition } from "@/src/features/exhibitor-import/server/exhibitorImportAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const editionId = new URL(request.url).searchParams.get("editionId");
  if (!editionId) {
    return NextResponse.json({ ok: false, error: "editionId is required." }, { status: 400 });
  }

  try {
    const batch = await getActiveBatchForEdition(editionId);
    if (!batch) {
      return NextResponse.json({ ok: true, batch: null });
    }
    return NextResponse.json({ ok: true, batch });
  } catch (error) {
    return exhibitorImportErrorResponse(error);
  }
}
