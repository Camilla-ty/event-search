import { NextResponse } from "next/server";

import {
  publishResearchPage,
  unpublishResearchPage,
} from "@/src/features/research-pages/server/researchPageAdmin";
import { YEAR_SCOPED_PUBLISH_BLOCKED_MESSAGE } from "@/src/features/research-pages/lib/researchPagePublishGuard";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

type PatchBody = {
  action?: string;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  const action = body.action?.trim();
  if (action !== "publish" && action !== "unpublish") {
    return NextResponse.json(
      { ok: false, error: 'action must be "publish" or "unpublish".' },
      { status: 400 },
    );
  }

  try {
    if (action === "publish") {
      await publishResearchPage(id);
    } else {
      await unpublishResearchPage(id);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      message === YEAR_SCOPED_PUBLISH_BLOCKED_MESSAGE
        ? 409
        : message === "Research page not found."
          ? 404
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
