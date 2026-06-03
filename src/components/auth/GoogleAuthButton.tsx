"use client";

import { useState } from "react";

import { Button } from "@/src/components/common";
import type { AuthCallbackFlow } from "@/src/lib/auth/buildAuthCallbackUrl";
import { buildAuthCallbackUrl } from "@/src/lib/auth/buildAuthCallbackUrl";
import { setOAuthRedirectStateCookies } from "@/src/lib/auth/oauthRedirectState";
import { safeRedirectTarget } from "@/src/lib/auth/safeRedirect";
import { createClient } from "@/src/lib/supabase/client";

export type GoogleAuthButtonProps = {
  redirectTo?: string;
  flow?: AuthCallbackFlow;
  className?: string;
  disabled?: boolean;
};

export function GoogleAuthButton({
  redirectTo = "/",
  flow = "signup",
  className,
  disabled = false,
}: GoogleAuthButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    setError(null);
    setIsLoading(true);

    try {
      const supabase = createClient();
      const nextPath = safeRedirectTarget(redirectTo, "/");
      setOAuthRedirectStateCookies(nextPath, flow);
      const callbackUrl = buildAuthCallbackUrl(window.location.origin);

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl,
          queryParams: {
            access_type: "online",
            prompt: "select_account",
          },
        },
      });

      if (oauthError) {
        setError(oauthError.message);
        setIsLoading(false);
      }
    } catch (caught) {
      const message =
        caught instanceof Error && caught.message.trim() !== ""
          ? caught.message.trim()
          : "Could not start Google sign-in.";
      setError(message);
      setIsLoading(false);
    }
  }

  return (
    <div className={className}>
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        disabled={disabled || isLoading}
        onClick={handleGoogleSignIn}
      >
        {isLoading ? "Redirecting to Google…" : "Continue with Google"}
      </Button>
      {error ? (
        <p className="mt-2 text-sm font-medium text-rose-700 dark:text-rose-300">{error}</p>
      ) : null}
    </div>
  );
}
