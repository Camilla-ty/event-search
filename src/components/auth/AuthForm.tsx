"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type FormEvent } from "react";

import { Button } from "@/src/components/common";

import { AuthFormError } from "./AuthFormError";
import { GoogleAuthButton } from "./GoogleAuthButton";
import { useSignupEmailOtp } from "./useSignupEmailOtp";

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
  const {
    step,
    setStep,
    email,
    setEmail,
    displayName,
    setDisplayName,
    otp: otpCode,
    setOtp,
    isSubmitting,
    error,
    setError,
    applyInitialEmail,
    handleSendOtp,
    handleVerifyOtp,
  } = useSignupEmailOtp(initialEmail);

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

    router.replace(redirectTo);
    router.refresh();
  }

  const loginHref = `/login?redirect=${encodeURIComponent(redirectTo)}`;

  return (
    <div className="space-y-5">
      <GoogleAuthButton redirectTo={redirectTo} flow="signup" />

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

      {step === "credentials" ? (
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
              disabled={isSubmitting}
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              placeholder="you@example.com"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Display name
            </span>
            <input
              id={`${idPrefix}-display-name`}
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              required
              disabled={isSubmitting}
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              placeholder="Your name"
            />
          </label>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Sending code…" : "Send verification code"}
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
              disabled={isSubmitting}
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm tracking-widest outline-none focus:border-slate-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              placeholder="123456"
            />
          </label>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              disabled={isSubmitting}
              className="w-full sm:w-auto"
              onClick={() => {
                setStep("credentials");
                setOtp("");
                setError(null);
              }}
            >
              Back
            </Button>
            <Button type="submit" disabled={isSubmitting} className="w-full sm:flex-1">
              {isSubmitting ? "Verifying…" : "Verify and continue"}
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
            Log in
          </Link>
        </p>
      ) : null}
    </div>
  );
}
