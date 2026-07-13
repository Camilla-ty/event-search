import { NextResponse } from "next/server";

import { getEventExplorerPage } from "@/src/features/events/server/getEventExplorerPage";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  try {
    const result = await getEventExplorerPage({
      q: searchParams.get("q"),
      regions: searchParams.getAll("region"),
      start: searchParams.get("start"),
      end: searchParams.get("end"),
      topics: searchParams.getAll("topic"),
      sort: searchParams.get("sort"),
      page: searchParams.get("page"),
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[api/events/explorer] getEventExplorerPage failed", {
      message,
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
