import { AUTH_NOTICE_EMAIL_ALREADY_REGISTERED } from "@/src/lib/auth/authMessages";
import { safeRedirectTarget } from "@/src/lib/auth/safeRedirect";

export function buildLoginEntryUrl(
  redirectTo: string,
  options?: { email?: string; notice?: typeof AUTH_NOTICE_EMAIL_ALREADY_REGISTERED },
): string {
  const url = new URL("/login", "http://local");
  url.searchParams.set("redirect", safeRedirectTarget(redirectTo, "/"));
  if (options?.email?.trim()) {
    url.searchParams.set("email", options.email.trim());
  }
  if (options?.notice) {
    url.searchParams.set("notice", options.notice);
  }
  return `${url.pathname}${url.search}`;
}

export function buildSignupEntryUrl(
  redirectTo: string,
  options?: { email?: string },
): string {
  const url = new URL("/signup", "http://local");
  url.searchParams.set("redirect", safeRedirectTarget(redirectTo, "/"));
  if (options?.email?.trim()) {
    url.searchParams.set("email", options.email.trim());
  }
  return `${url.pathname}${url.search}`;
}
