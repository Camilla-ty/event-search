import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  parseAuthCallbackQuery,
  type AuthCallbackFlow,
} from "@/src/lib/auth/buildAuthCallbackUrl";
import { buildAuthEntryUrlWithOAuthError } from "@/src/lib/auth/resolveOAuthError";
import { clearOAuthRedirectStateOnResponse } from "@/src/lib/auth/oauthRedirectState";
import { waitForAuthCookieFlush } from "@/src/lib/auth/oauthCallbackServer";
import { supabasePkceVerifierCookieName } from "@/src/lib/auth/supabaseCookieStorageKey";

function buildErrorRedirect(
  origin: string,
  flow: AuthCallbackFlow,
  next: string,
  message: string,
): NextResponse {
  const errorPath = flow === "login" ? "/login" : "/signup";
  const entryPath = buildAuthEntryUrlWithOAuthError(errorPath, next, message);
  const redirectUrl = new URL(entryPath, origin);
  const response = NextResponse.redirect(redirectUrl);
  clearOAuthRedirectStateOnResponse(response);
  response.cookies.set(supabasePkceVerifierCookieName(), "", { maxAge: 0, path: "/" });
  return response;
}

function createCallbackSupabase(
  request: NextRequest,
  response: NextResponse,
  supabaseUrl: string,
  supabaseAnonKey: string,
) {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const requestCookies = request.cookies.getAll();
  const { next, flow } = parseAuthCallbackQuery(url.searchParams, requestCookies);
  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error");
  const oauthErrorDescription = url.searchParams.get("error_description");

  const successRedirect = new URL(next, url.origin);
  let response = NextResponse.redirect(successRedirect);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[auth/callback] missing Supabase env");
    return buildErrorRedirect(url.origin, flow, next, "Server auth is not configured.");
  }

  if (!code) {
    if (oauthError) {
      const supabase = createCallbackSupabase(
        request,
        response,
        supabaseUrl,
        supabaseAnonKey,
      );
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        clearOAuthRedirectStateOnResponse(response);
        return response;
      }

      const description = oauthErrorDescription?.trim() ?? "";
      const message = description !== "" ? description : oauthError;
      console.error("[auth/callback] OAuth provider error", {
        error_code: url.searchParams.get("error_code"),
      });
      return buildErrorRedirect(url.origin, flow, next, message);
    }

    clearOAuthRedirectStateOnResponse(response);
    return response;
  }

  const supabase = createCallbackSupabase(
    request,
    response,
    supabaseUrl,
    supabaseAnonKey,
  );

  const cookieFlush = waitForAuthCookieFlush(supabase);
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] exchangeCodeForSession failed");
    return buildErrorRedirect(url.origin, flow, next, error.message);
  }

  try {
    await cookieFlush;
  } catch (flushError) {
    const hasSessionCookies = response.cookies
      .getAll()
      .some((cookie) => cookie.name.includes("auth-token"));
    if (!hasSessionCookies) {
      const message =
        flushError instanceof Error ? flushError.message : "Cookie flush failed.";
      console.error("[auth/callback] cookie flush failed", { message });
      return buildErrorRedirect(url.origin, flow, next, message);
    }
  }

  clearOAuthRedirectStateOnResponse(response);
  return response;
}
