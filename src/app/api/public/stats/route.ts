import { NextResponse } from "next/server";

import { publicStatsCorsHeaders } from "@/src/lib/http/publicStatsCors";
import { getPublicStats } from "@/src/lib/queries/publicStats";

export const revalidate = 3600;

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("Origin");
  const corsHeaders = publicStatsCorsHeaders(origin);

  if (Object.keys(corsHeaders).length === 0) {
    return new NextResponse(null, { status: 204 });
  }

  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: Request) {
  const corsHeaders = publicStatsCorsHeaders(request.headers.get("Origin"));

  try {
    const stats = await getPublicStats();

    return NextResponse.json(stats, {
      headers: {
        ...corsHeaders,
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[api/public/stats] getPublicStats failed", { message });
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: corsHeaders },
    );
  }
}
