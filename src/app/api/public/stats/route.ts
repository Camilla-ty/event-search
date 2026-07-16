import { NextResponse } from "next/server";

import { getPublicStats } from "@/src/lib/queries/publicStats";

export const revalidate = 3600;

export async function GET() {
  try {
    const stats = await getPublicStats();

    return NextResponse.json(stats, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[api/public/stats] getPublicStats failed", { message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
