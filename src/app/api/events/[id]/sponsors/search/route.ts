import { NextResponse } from "next/server";

import { searchPublicEditionSponsors } from "@/src/features/events/server/publicSponsorSearch";

type RouteContext = { params: Promise<{ id: string }> };

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

function errorResponse(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status, headers: NO_STORE_HEADERS });
}

/**
 * Authenticated-only edition Sponsor Search (v1).
 * @see docs/phase-sponsor-search-scope.md
 */
export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  try {
    const result = await searchPublicEditionSponsors(id, q);
    if (!result.ok) {
      return errorResponse(result.status, result.error);
    }

    return NextResponse.json(
      { ok: true, query: result.query, items: result.items },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[api/events/[id]/sponsors/search] failed", { message });
    return errorResponse(500, "Failed to search sponsors.");
  }
}
