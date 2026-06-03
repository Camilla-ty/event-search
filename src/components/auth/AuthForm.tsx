"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/src/components/common";
import {
  AUTH_GO_TO_LOGIN,
  AUTH_REDIRECTING_AFTER_AUTH,
  AUTH_REDIRECTING_TO_LOGIN,
} from "@/src/lib/auth/authMessages";
import { buildLoginEntryUrl } from "@/src/lib/auth/buildAuthEntryUrl";
import { applyPostAuthRedirect } from "@/src/lib/auth/resolvePostAuthRedirect";

import { AuthFormError } from "./AuthFormError";
import { AuthIntentRedirectOverlay } from "./AuthIntentRedirectOverlay";
import { GoogleAuthButton } from "./GoogleAuthButton";
import { useEmailOtpAuth } from "./useEmailOtpAuth";

export type AuthFormProps = {
  initialEmail?: string;
  redirectTo?: string;
  onSuccess?: () => void;
  showLoginLink?: boolean;
  idPrefix?: string;
};

export function AuthForm({
  initialEmail = "",
  redirectTo = "/",
  onSuccess,
  showLoginLink = true,
  idPrefix = "auth-form",
}: AuthFormProps) {
  const router = useRouter();
  const [isCompletingAuth, setIsCompletingAuth] = useState(false);
  const {
    step,
    setStep,
    email,
    setEmail,
    otp: otpCode,
    setOtp,
    isBusy,
    isNavigatingAway,
    intentRedirectMessage,
    error,
    setError,
    applyInitialEmail,
    handleSendOtp,
    handleVerifyOtp,
  } = useEmailOtpAuth({
    intent: "signup",
    initialEmail,
    redirectTo,
  });

  const formBusy = isBusy || isCompletingAuth;

  useEffect(() => {
    applyInitialEmail(initialEmail);
  }, [initialEmail, applyInitialEmail]);

  async function handleVerifySubmit(event: FormEvent<HTMLFormElement>) {
    const verified = await handleVerifyOtp(event);
    if (!verified) {
      return;
    }

    if (onSuccess) {
      onSuccess();
      return;
    }

    setIsCompletingAuth(true);
    applyPostAuthRedirect(router, redirectTo);
  }

  const loginHref = buildLoginEntryUrl(redirectTo, {
    email: email.trim() !== "" ? email.trim() : undefined,
  });

  if (isCompletingAuth) {
    return (
      <div className="space-y-5">
        <AuthIntentRedirectOverlay
          message="Your account is ready."
          statusLine={AUTH_REDIRECTING_AFTER_AUTH}
        />
      </div>
    );
  }

  if (isNavigatingAway && intentRedirectMessage) {
    return (
      <div className="space-y-5">
        <AuthIntentRedirectOverlay
          message={intentRedirectMessage}
          statusLine={AUTH_REDIRECTING_TO_LOGIN}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <GoogleAuthButton
        redirectTo={redirectTo}
        flow="signup"
        disabled={formBusy}
      />

      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-slate-200 dark:border-slate-700" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            Or continue with email
          </span>
        </div>
      </div>

      {step === "collect" ? (
        <form onSubmit={handleSendOtp} className="space-y-4" noValidate>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Email
            </span>
            <input
              id={`${idPrefix}-email`}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={formBusy}
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              placeholder="you@example.com"
            />
          </label>

          <Button type="submit" disabled={formBusy} className="w-full">
            {formBusy ? "Sending code…" : "Send verification code"}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleVerifySubmit} className="space-y-4" noValidate>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Enter the code sent to{" "}
            <span className="font-medium">{email.trim()}</span>.
          </p>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Verification code
            </span>
            <input
              id={`${idPrefix}-otp`}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otpCode}
              onChange={(event) => setOtp(event.target.value)}
              required
              disabled={formBusy}
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm tracking-widest outline-none focus:border-slate-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              placeholder="123456"
            />
          </label>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              disabled={formBusy}
              className="w-full sm:w-auto"
              onClick={() => {
                setStep("collect");
                setOtp("");
                setError(null);
              }}
            >
              Back
            </Button>
            <Button type="submit" disabled={formBusy} className="w-full sm:flex-1">
              {formBusy ? "Verifying…" : "Verify and continue"}
            </Button>
          </div>
        </form>
      )}

      {error ? <AuthFormError message={error} /> : null}

      {showLoginLink ? (
        <p className="text-center text-sm text-slate-600 dark:text-slate-300">
          Already have an account?{" "}
          <Link
            href={loginHref}
            className="font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400"
          >
            {AUTH_GO_TO_LOGIN}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
