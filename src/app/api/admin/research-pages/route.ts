import { NextResponse } from "next/server";

import {
  createResearchPageDraft,
  listResearchPagesAdmin,
} from "@/src/features/research-pages/server/researchPageAdmin";
import { requireAdminApi } from "@/src/lib/auth/requireAdminApi";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const pages = await listResearchPagesAdmin();
    return NextResponse.json({ ok: true, pages });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

type CreateBody = {
  topic_keyword_id?: string;
  region_id?: string;
};

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  const topicKeywordId = body.topic_keyword_id?.trim() ?? "";
  const regionId = body.region_id?.trim() ?? "";
  const errors: string[] = [];

  if (!topicKeywordId) errors.push("topic_keyword_id is required");
  if (!regionId) errors.push("region_id is required");

  if (errors.length > 0) {
    return NextResponse.json(
      { ok: false, error: errors.join("; ") },
      { status: 400 },
    );
  }

  try {
    const result = await createResearchPageDraft({
      topicKeywordId,
      regionId,
    });
    return NextResponse.json({ ok: true, page: result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("already exists") ? 409 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
