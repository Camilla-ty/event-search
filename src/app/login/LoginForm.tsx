"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuthEntryUrlCleanup } from "@/src/components/auth/authEntryUrlCleanup";
import { AuthFormError } from "@/src/components/auth/AuthFormError";
import { AuthIntentRedirectOverlay } from "@/src/components/auth/AuthIntentRedirectOverlay";
import { AuthOAuthErrorBanner } from "@/src/components/auth/AuthOAuthErrorBanner";
import { GoogleAuthButton } from "@/src/components/auth/GoogleAuthButton";
import { useEmailOtpAuth } from "@/src/components/auth/useEmailOtpAuth";
import { Button } from "@/src/components/common";
import {
  AUTH_CREATE_ACCOUNT,
  AUTH_GO_TO_SIGNUP,
  AUTH_REDIRECTING_AFTER_AUTH,
  AUTH_TRY_DIFFERENT_EMAIL,
} from "@/src/lib/auth/authMessages";
import { buildSignupEntryUrl } from "@/src/lib/auth/buildAuthEntryUrl";
import { consumeAuthEntryParams } from "@/src/lib/auth/consumeAuthEntryParams";
import { applyPostAuthRedirect } from "@/src/lib/auth/resolvePostAuthRedirect";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [entryParams] = useState(() => consumeAuthEntryParams(searchParams));
  const { redirectTo, email: entryEmail, noticeMessage, oauthError } = entryParams;

  useAuthEntryUrlCleanup(router, "/login", redirectTo, searchParams);

  const [isCompletingAuth, setIsCompletingAuth] = useState(false);

  const {
    step,
    setStep,
    email,
    setEmail,
    otp,
    setOtp,
    isBusy,
    error,
    setError,
    intentBlock,
    clearIntentBlock,
    applyInitialEmail,
    handleSendOtp,
    handleVerifyOtp,
  } = useEmailOtpAuth({
    intent: "login",
    initialEmail: entryEmail ?? "",
    redirectTo,
  });

  const formBusy = isBusy || isCompletingAuth;

  useEffect(() => {
    applyInitialEmail(entryEmail ?? "");
  }, [entryEmail, applyInitialEmail]);

  const signupHref = buildSignupEntryUrl(redirectTo, { email });

  async function handleVerifySubmit(event: FormEvent<HTMLFormElement>) {
    const verified = await handleVerifyOtp(event);
    if (!verified) {
      return;
    }
    setIsCompletingAuth(true);
    applyPostAuthRedirect(router, redirectTo);
  }

  const signupLinkHref =
    intentBlock?.redirectPath ??
    buildSignupEntryUrl(redirectTo, { email: email.trim() });

  if (isCompletingAuth) {
    return (
      <LoginCard>
        <AuthIntentRedirectOverlay
          message="You're signed in."
          statusLine={AUTH_REDIRECTING_AFTER_AUTH}
        />
      </LoginCard>
    );
  }

  return (
    <LoginCard>
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Log in with email
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          For existing members only. Use Google or a one-time email code.
        </p>
      </header>

      <AuthOAuthErrorBanner error={oauthError} className="mt-4" />

      {noticeMessage ? (
        <div className="mt-4">
          <AuthFormError message={noticeMessage} />
        </div>
      ) : null}

      {intentBlock ? (
        <div className="mt-6 space-y-4">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {intentBlock.message}
          </p>
          <Link
            href={signupLinkHref}
            className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {AUTH_GO_TO_SIGNUP}
          </Link>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={clearIntentBlock}
          >
            {AUTH_TRY_DIFFERENT_EMAIL}
          </Button>
        </div>
      ) : step === "collect" ? (
        <div className="mt-6 space-y-4">
          <GoogleAuthButton
            redirectTo={redirectTo}
            flow="login"
            disabled={formBusy}
          />

          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-slate-200 dark:border-slate-700" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                Or email code
              </span>
            </div>
          </div>

          <form onSubmit={handleSendOtp} className="space-y-4" noValidate>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Email
              </span>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  clearIntentBlock();
                }}
                required
                disabled={formBusy}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                placeholder="you@example.com"
              />
            </label>

            <Button type="submit" disabled={formBusy} className="w-full">
              {formBusy ? "Sending code…" : "Get OTP Code"}
            </Button>
          </form>
        </div>
      ) : (
        <form onSubmit={handleVerifySubmit} className="mt-6 space-y-4" noValidate>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Enter the code sent to <span className="font-medium">{email.trim()}</span>.
          </p>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Verification code
            </span>
            <input
              id="login-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
              required
              disabled={formBusy}
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm tracking-widest outline-none focus:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
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
              {formBusy ? "Verifying…" : "Verify OTP"}
            </Button>
          </div>
        </form>
      )}

      {error ? (
        <div className="mt-4">
          <AuthFormError message={error} />
        </div>
      ) : null}

      <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-300">
        New to HandShakes?{" "}
        <Link
          href={signupHref}
          className="font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400"
        >
          {AUTH_CREATE_ACCOUNT}
        </Link>
      </p>
    </LoginCard>
  );
}

function LoginCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {children}
    </div>
  );
}
