"use client";

import { FormEvent, useCallback, useState } from "react";

import { fetchAuthUserExists } from "@/src/lib/auth/fetchAuthUserExists";
import { createClient } from "@/src/lib/supabase/client";

export type SignupOtpStep = "credentials" | "verify";

export function useSignupEmailOtp(initialEmail = "") {
  const [step, setStep] = useState<SignupOtpStep>("credentials");
  const [email, setEmail] = useState(initialEmail);
  const [displayName, setDisplayName] = useState("");
  const [otp, setOtp] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback((prefilledEmail = "") => {
    setStep("credentials");
    setEmail(prefilledEmail);
    setDisplayName("");
    setOtp("");
    setError(null);
    setIsSubmitting(false);
  }, []);

  const applyInitialEmail = useCallback((value: string) => {
    const trimmed = value.trim();
    if (trimmed) {
      setEmail(trimmed);
    }
  }, []);

  async function handleSendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const trimmedEmail = email.trim();
    const trimmedDisplayName = displayName.trim();

    if (!trimmedEmail) {
      setError("Email is required.");
      setIsSubmitting(false);
      return;
    }
    if (!trimmedDisplayName) {
      setError("Display name is required.");
      setIsSubmitting(false);
      return;
    }

    try {
      const { error: checkError } = await fetchAuthUserExists(trimmedEmail);
      if (checkError) {
        setError(checkError);
        return;
      }

      const supabase = createClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          shouldCreateUser: true,
          data: { display_name: trimmedDisplayName },
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
          : "Could not send verification code.";
      setError(message);
    } finally {
      setIsSubmitting(false);
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
      setError("Enter the code from your email.");
      setIsSubmitting(false);
      return false;
    }

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
        setError("Verification succeeded but no session was created. Try again.");
        return false;
      }

      return true;
    } catch (verifyFailure) {
      const message =
        verifyFailure instanceof Error && verifyFailure.message.trim() !== ""
          ? verifyFailure.message.trim()
          : "Verification failed.";
      setError(message);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    step,
    setStep,
    email,
    setEmail,
    displayName,
    setDisplayName,
    otp,
    setOtp,
    isSubmitting,
    error,
    setError,
    reset,
    applyInitialEmail,
    handleSendOtp,
    handleVerifyOtp,
  };
}
