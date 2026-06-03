"use client";

import Link from "next/link";
import { FormEvent, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AuthFormError } from "@/src/components/auth/AuthFormError";
import { OAuthProviderErrorHelp } from "@/src/components/auth/OAuthProviderErrorHelp";
import { GoogleAuthButton } from "@/src/components/auth/GoogleAuthButton";
import { Button } from "@/src/components/common";
import { fetchAuthUserExists } from "@/src/lib/auth/fetchAuthUserExists";
import { safeRedirectTarget } from "@/src/lib/auth/safeRedirect";
import { createClient } from "@/src/lib/supabase/client";

type Step = "email" | "verify";

const DEFAULT_REDIRECT = "/";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeRedirectTarget(
    searchParams.get("redirect"),
    DEFAULT_REDIRECT,
  );
  const oauthErrorParam = searchParams.get("error");

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(
    typeof oauthErrorParam === "string" && oauthErrorParam.trim() !== ""
      ? oauthErrorParam.trim()
      : null,
  );
  const [accountNotFound, setAccountNotFound] = useState(false);

  const signupHref = `/signup?redirect=${encodeURIComponent(redirectTo)}${
    email.trim() ? `&email=${encodeURIComponent(email.trim())}` : ""
  }`;

  async function handleSendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setAccountNotFound(false);
    setIsSubmitting(true);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Email is required.");
      setIsSubmitting(false);
      return;
    }

    try {
      const { exists, error: checkError } = await fetchAuthUserExists(trimmedEmail);
      if (checkError) {
        setError(checkError);
        return;
      }
      if (!exists) {
        setAccountNotFound(true);
        return;
      }

      const supabase = createClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          shouldCreateUser: false,
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

  async function handleVerifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const trimmedEmail = email.trim();
    const token = otp.trim();

    if (!trimmedEmail || token === "") {
      setError("Enter the code from your email.");
      setIsSubmitting(false);
      return;
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
        return;
      }

      if (!data.session) {
        setError("Verification succeeded but no session was created. Try again.");
        return;
      }

      router.replace(redirectTo);
      router.refresh();
    } catch (verifyFailure) {
      const message =
        verifyFailure instanceof Error && verifyFailure.message.trim() !== ""
          ? verifyFailure.message.trim()
          : "Verification failed.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
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

      {accountNotFound ? (
        <div className="mt-6 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            No account found for{" "}
            <span className="font-medium">{email.trim()}</span>.
          </p>
          <Link
            href={signupHref}
            className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Sign up instead
          </Link>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => {
              setAccountNotFound(false);
              setError(null);
            }}
          >
            Try a different email
          </Button>
        </div>
      ) : step === "email" ? (
        <div className="mt-6 space-y-4">
          <GoogleAuthButton redirectTo={redirectTo} flow="login" />

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
                  setAccountNotFound(false);
                }}
                required
                disabled={isSubmitting}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                placeholder="you@example.com"
              />
            </label>

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Sending code…" : "Get OTP Code"}
            </Button>
          </form>
        </div>
      ) : (
        <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4" noValidate>
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
              disabled={isSubmitting}
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm tracking-widest outline-none focus:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
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
                setStep("email");
                setOtp("");
                setError(null);
              }}
            >
              Back
            </Button>
            <Button type="submit" disabled={isSubmitting} className="w-full sm:flex-1">
              {isSubmitting ? "Verifying…" : "Verify OTP"}
            </Button>
          </div>
        </form>
      )}

      {error ? (
        <div className="mt-4">
          <AuthFormError message={error} />
          <OAuthProviderErrorHelp message={error} />
        </div>
      ) : null}

      <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-300">
        New to HandShakes?{" "}
        <Link
          href={signupHref}
          className="font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400"
        >
          Create an account
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
