"use client";

import { FormEvent, useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import {
  AUTH_DISPLAY_NAME_REQUIRED,
  AUTH_EMAIL_REQUIRED,
  AUTH_NO_SESSION_AFTER_VERIFY,
  AUTH_OTP_CODE_REQUIRED,
  AUTH_OTP_SEND_FAILED,
  AUTH_VERIFY_FAILED,
  SIGNUP_EMAIL_ALREADY_REGISTERED_MESSAGE,
} from "@/src/lib/auth/authMessages";
import {
  resolveAuthIntent,
  type AuthIntent,
} from "@/src/lib/auth/resolveAuthIntent";
import { createClient } from "@/src/lib/supabase/client";

export type EmailOtpStep = "collect" | "verify";

export type IntentBlock = {
  message: string;
  redirectPath: string;
};

export type UseEmailOtpAuthOptions = {
  intent: AuthIntent;
  initialEmail?: string;
  redirectTo?: string;
};

export function useEmailOtpAuth({
  intent,
  initialEmail = "",
  redirectTo = "/",
}: UseEmailOtpAuthOptions) {
  const router = useRouter();
  const [step, setStep] = useState<EmailOtpStep>("collect");
  const [email, setEmail] = useState(initialEmail);
  const [displayName, setDisplayName] = useState("");
  const [otp, setOtp] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNavigatingAway, setIsNavigatingAway] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intentBlock, setIntentBlock] = useState<IntentBlock | null>(null);
  const [intentRedirectMessage, setIntentRedirectMessage] = useState<string | null>(
    null,
  );

  const requiresDisplayName = intent === "signup";

  const reset = useCallback((prefilledEmail = "") => {
    setStep("collect");
    setEmail(prefilledEmail);
    setDisplayName("");
    setOtp("");
    setError(null);
    setIntentBlock(null);
    setIntentRedirectMessage(null);
    setIsNavigatingAway(false);
    setIsSubmitting(false);
  }, []);

  const applyInitialEmail = useCallback((value: string) => {
    const trimmed = value.trim();
    if (trimmed) {
      setEmail(trimmed);
    }
  }, []);

  const clearIntentBlock = useCallback(() => {
    setIntentBlock(null);
    setError(null);
  }, []);

  async function handleSendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIntentBlock(null);
    setIntentRedirectMessage(null);
    setIsNavigatingAway(false);
    setIsSubmitting(true);

    let didNavigateAway = false;

    const trimmedEmail = email.trim();
    const trimmedDisplayName = displayName.trim();

    if (!trimmedEmail) {
      setError(AUTH_EMAIL_REQUIRED);
      setIsSubmitting(false);
      return;
    }
    if (requiresDisplayName && !trimmedDisplayName) {
      setError(AUTH_DISPLAY_NAME_REQUIRED);
      setIsSubmitting(false);
      return;
    }

    try {
      const resolved = await resolveAuthIntent(trimmedEmail, intent, redirectTo);

      if (resolved.checkError) {
        setError(resolved.checkError);
        return;
      }

      if (resolved.recommendedAction !== "proceed") {
        if (resolved.message && resolved.redirectPath) {
          if (intent === "signup") {
            setIntentRedirectMessage(
              resolved.message ?? SIGNUP_EMAIL_ALREADY_REGISTERED_MESSAGE,
            );
            setIsNavigatingAway(true);
            didNavigateAway = true;
            await new Promise<void>((resolve) => {
              requestAnimationFrame(() => {
                requestAnimationFrame(() => resolve());
              });
            });
            router.replace(resolved.redirectPath);
            return;
          }
          setIntentBlock({
            message: resolved.message,
            redirectPath: resolved.redirectPath,
          });
        }
        return;
      }

      const supabase = createClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          shouldCreateUser: intent === "signup",
          ...(intent === "signup"
            ? { data: { display_name: trimmedDisplayName } }
            : {}),
        },
      });

      if (otpError) {
        setError(otpError.message);
        return;
      }

      setStep("verify");
    } catch (sendError) {
      const message =
        sendError instanceof Error && sendError.message.trim() !== ""
          ? sendError.message.trim()
          : AUTH_OTP_SEND_FAILED;
      setError(message);
    } finally {
      if (!didNavigateAway) {
        setIsSubmitting(false);
      }
    }
  }

  async function handleVerifyOtp(
    event: FormEvent<HTMLFormElement>,
  ): Promise<boolean> {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const trimmedEmail = email.trim();
    const token = otp.trim();

    if (!trimmedEmail || token === "") {
      setError(AUTH_OTP_CODE_REQUIRED);
      setIsSubmitting(false);
      return false;
    }

    let verified = false;
    try {
      const supabase = createClient();
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: trimmedEmail,
        token,
        type: "email",
      });

      if (verifyError) {
        setError(verifyError.message);
        return false;
      }

      if (!data.session) {
        setError(AUTH_NO_SESSION_AFTER_VERIFY);
        return false;
      }

      verified = true;
      return true;
    } catch (verifyFailure) {
      const message =
        verifyFailure instanceof Error && verifyFailure.message.trim() !== ""
          ? verifyFailure.message.trim()
          : AUTH_VERIFY_FAILED;
      setError(message);
      return false;
    } finally {
      if (!verified) {
        setIsSubmitting(false);
      }
    }
  }

  return {
    intent,
    requiresDisplayName,
    step,
    setStep,
    email,
    setEmail,
    displayName,
    setDisplayName,
    otp,
    setOtp,
    isSubmitting,
    isNavigatingAway,
    intentRedirectMessage,
    isBusy: isSubmitting || isNavigatingAway,
    error,
    setError,
    intentBlock,
    clearIntentBlock,
    reset,
    applyInitialEmail,
    handleSendOtp,
    handleVerifyOtp,
  };
}
