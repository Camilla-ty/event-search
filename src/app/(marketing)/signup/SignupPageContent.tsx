"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { AuthForm } from "@/src/components/auth/AuthForm";
import { AuthFormError } from "@/src/components/auth/AuthFormError";
import { safeRedirectTarget } from "@/src/lib/auth/safeRedirect";

const SIGNUP_BENEFITS = [
  "Unlock all event sponsors",
  "Discover companies attending events",
  "Save and track companies (coming soon)",
  "Access the full event ecosystem",
] as const;

type SignupPageContentProps = {
  oauthError?: string | null;
};

export function SignupPageContent({ oauthError = null }: SignupPageContentProps) {
  const searchParams = useSearchParams();
  const redirectTo = safeRedirectTarget(searchParams.get("redirect"), "/");
  const initialEmail =
    typeof searchParams.get("email") === "string"
      ? searchParams.get("email")?.trim() ?? ""
      : "";

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-10 lg:grid-cols-2 lg:items-start">
      <section className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-wide text-violet-600 dark:text-violet-400">
            Get started free
          </p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
            Join HandShakes
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-300">
            Create your account to explore sponsors, events, and the companies shaping
            the conference ecosystem.
          </p>
        </div>

        <ul className="space-y-3">
          {SIGNUP_BENEFITS.map((benefit) => (
            <li
              key={benefit}
              className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300"
            >
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
                aria-hidden="true"
              >
                ✓
              </span>
              {benefit}
            </li>
          ))}
        </ul>

        <p className="text-sm text-slate-500 dark:text-slate-400">
          Already have an account?{" "}
          <Link
            href={`/login?redirect=${encodeURIComponent(redirectTo)}`}
            className="font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400"
          >
            Log in
          </Link>
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Create your account
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Sign up with Google or a one-time email code. No password required.
        </p>

        <div className="mt-6">
          {oauthError ? (
            <div className="mb-4">
              <AuthFormError message={oauthError} />
            </div>
          ) : null}
          <AuthForm
            initialEmail={initialEmail}
            redirectTo={redirectTo}
            showLoginLink={false}
            idPrefix="signup-page"
          />
        </div>
      </section>
    </div>
  );
}
