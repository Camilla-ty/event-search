import { NextResponse } from "next/server";

import {
  getPublicSponsorTierPage,
  parsePublicSponsorTierPage,
  parsePublicSponsorTierRank,
  resolvePublicSponsorEditionId,
} from "@/src/features/events/server/publicSponsorRoster";
import { createClient } from "@/src/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

function errorResponse(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status, headers: NO_STORE_HEADERS });
}

/**
 * Public sponsor roster: one tier, first page (ADR-003 Phase 3).
 * Anonymous callers may only read Tier 1; Tier 2+ requires a session.
 */
export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);

  const tierRank = parsePublicSponsorTierRank(searchParams.get("tier_rank"));
  if (tierRank === null) {
    return errorResponse(400, "Invalid tier_rank.");
  }

  const page = parsePublicSponsorTierPage(searchParams.get("page"));
  if (page === null) {
    return errorResponse(400, "Invalid page.");
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (tierRank !== 1 && user === null) {
      return errorResponse(401, "Authentication required.");
    }

    const editionId = await resolvePublicSponsorEditionId(id);
    if (editionId === null) {
      return errorResponse(404, "Edition not found.");
    }

    const result = await getPublicSponsorTierPage(editionId, {
      tierRank,
      page,
      user,
    });

    if (!result.ok) {
      return errorResponse(result.status, result.error);
    }

    return NextResponse.json(result.data, { headers: NO_STORE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[api/events/[id]/sponsors] tier page failed", { message });
    return errorResponse(500, "Failed to load sponsors.");
  }
}
