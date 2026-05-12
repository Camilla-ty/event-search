import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/src/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Public marketing pages should not block on Supabase auth roundtrips.
  // We only run session refresh + auth enforcement on /admin/*.
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  const { response, user } = await updateSession(request);

  if (!user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
