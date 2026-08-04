"use client";

import { useState } from "react";

import { Button } from "@/src/components/common";
import { AUTH_MICROSOFT_START_FAILED } from "@/src/lib/auth/authMessages";
import { resolveOAuthErrorFromMessage } from "@/src/lib/auth/resolveOAuthError";
import type { AuthCallbackFlow } from "@/src/lib/auth/buildAuthCallbackUrl";
import { buildAuthCallbackUrl } from "@/src/lib/auth/buildAuthCallbackUrl";
import { setOAuthRedirectStateCookies } from "@/src/lib/auth/oauthRedirectState";
import { safeRedirectTarget } from "@/src/lib/auth/safeRedirect";
import { createClient } from "@/src/lib/supabase/client";

import { AuthOAuthErrorBanner } from "./AuthOAuthErrorBanner";

export type MicrosoftAuthButtonProps = {
  redirectTo?: string;
  flow?: AuthCallbackFlow;
  className?: string;
  disabled?: boolean;
};

export function MicrosoftAuthButton({
  redirectTo = "/",
  flow = "signup",
  className,
  disabled = false,
}: MicrosoftAuthButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleMicrosoftSignIn() {
    setError(null);
    setIsLoading(true);

    try {
      const supabase = createClient();
      const nextPath = safeRedirectTarget(redirectTo, "/");
      setOAuthRedirectStateCookies(nextPath, flow);
      const callbackUrl = buildAuthCallbackUrl(window.location.origin);

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "azure",
        options: {
          redirectTo: callbackUrl,
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
          : AUTH_MICROSOFT_START_FAILED;
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
        onClick={handleMicrosoftSignIn}
      >
        {isLoading ? "Redirecting to Microsoft…" : "Continue with Microsoft"}
      </Button>
      <AuthOAuthErrorBanner
        error={resolveOAuthErrorFromMessage(error)}
        className="mt-2"
      />
    </div>
  );
}
