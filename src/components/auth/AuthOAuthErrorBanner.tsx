"use client";

import type { ResolvedOAuthError } from "@/src/lib/auth/resolveOAuthError";

import { AuthFormError } from "./AuthFormError";
import { OAuthProviderErrorHelp } from "./OAuthProviderErrorHelp";

export type AuthOAuthErrorBannerProps = {
  error: ResolvedOAuthError | null;
  className?: string;
};

/** Shared OAuth error display for login and signup entry pages. */
export function AuthOAuthErrorBanner({
  error,
  className = "mt-4",
}: AuthOAuthErrorBannerProps) {
  if (!error) {
    return null;
  }

  return (
    <div className={className}>
      <AuthFormError message={error.message} />
      {error.showProviderHelp ? (
        <OAuthProviderErrorHelp message={error.message} />
      ) : null}
    </div>
  );
}
