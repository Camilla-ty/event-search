import { NextResponse } from "next/server";

import { getSponsorDiscoverySuggestions } from "@/src/features/sponsors/server/getSponsorDiscoverySuggestions";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  try {
    const result = await getSponsorDiscoverySuggestions({
      q: searchParams.get("q"),
      limit: searchParams.get("limit"),
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[api/sponsors/suggest] getSponsorDiscoverySuggestions failed", {
      message,
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
