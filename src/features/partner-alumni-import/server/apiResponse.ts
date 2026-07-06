import { NextResponse } from "next/server";

import { PartnerAlumniAdminError } from "@/src/features/partner-alumni/server/partnerAlumniAdmin";
import { SponsorImportHttpError } from "@/src/features/sponsor-import/server/errors";

import {
  isUniqueViolation,
  PartnerAlumniImportHttpError,
  uniqueViolationUserMessage,
} from "./errors";

export function partnerAlumniImportErrorResponse(error: unknown): NextResponse {
  if (error instanceof PartnerAlumniImportHttpError) {
    return NextResponse.json(
      { ok: false, error: error.message, details: error.details ?? null },
      { status: error.status },
    );
  }

  if (error instanceof PartnerAlumniAdminError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }

  if (error instanceof SponsorImportHttpError) {
    return NextResponse.json(
      { ok: false, error: error.message, details: error.details ?? null },
      { status: error.status },
    );
  }

  const message = error instanceof Error ? error.message : "Unknown error";
  if (isUniqueViolation(message)) {
    return NextResponse.json(
      {
        ok: false,
        error: uniqueViolationUserMessage(message),
        details: { message },
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: false, error: message }, { status: 500 });
}
