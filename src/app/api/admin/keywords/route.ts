import { NextResponse } from "next/server";

import { listKeywordsAdmin } from "@/src/features/events/server/seriesKeywordsAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const keywords = await listKeywordsAdmin();
    return NextResponse.json({ ok: true, keywords });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
