import { NextResponse } from "next/server";

import { getSponsorDiscoveryPage } from "@/src/features/sponsors/server/getSponsorDiscoveryPage";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  try {
    const result = await getSponsorDiscoveryPage({
      q: searchParams.get("q"),
      event: searchParams.get("event"),
      sort: searchParams.get("sort"),
      page: searchParams.get("page"),
      pageSize: searchParams.get("page_size"),
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[api/sponsors/discovery] getSponsorDiscoveryPage failed", {
      message,
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
