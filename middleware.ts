import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/src/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Do not refresh session on OAuth callback — getUser() can mutate cookies and
  // drop the PKCE code-verifier before exchangeCodeForSession runs.
  if (pathname.startsWith("/auth/callback")) {
    return NextResponse.next();
  }

  const { response, user } = await updateSession(request);

  if (pathname.startsWith("/admin")) {
    if (!user) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.search = "";
      redirectUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
