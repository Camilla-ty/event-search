import { NextResponse } from "next/server";

import { isUniqueViolation, ExhibitorImportHttpError, uniqueViolationUserMessage } from "./errors";

export function exhibitorImportErrorResponse(error: unknown): NextResponse {
  if (error instanceof ExhibitorImportHttpError) {
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
