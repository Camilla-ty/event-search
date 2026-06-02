import { NextResponse } from "next/server";

import { checkAuthUserExistsByEmail } from "@/src/lib/auth/checkAuthUserByEmail";

type CheckEmailBody = {
  email?: string;
};

export async function POST(request: Request) {
  let body: CheckEmailBody;
  try {
    body = (await request.json()) as CheckEmailBody;
  } catch {
    return NextResponse.json(
      { exists: false, error: "Invalid request body." },
      { status: 400 },
    );
  }

  const rawEmail = typeof body.email === "string" ? body.email : "";
  const result = await checkAuthUserExistsByEmail(rawEmail);

  if (result.error && result.email === null) {
    return NextResponse.json(
      { exists: false, error: result.error },
      { status: 400 },
    );
  }

  if (result.error) {
    return NextResponse.json(
      { exists: false, error: result.error },
      { status: 500 },
    );
  }

  return NextResponse.json({ exists: result.exists });
}
