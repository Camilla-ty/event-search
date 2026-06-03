"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";

import { useAuthEntryUrlCleanup } from "@/src/components/auth/authEntryUrlCleanup";
import { AuthForm } from "@/src/components/auth/AuthForm";
import { AuthOAuthErrorBanner } from "@/src/components/auth/AuthOAuthErrorBanner";
import { consumeAuthEntryParams } from "@/src/lib/auth/consumeAuthEntryParams";

export default function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [entryParams] = useState(() => consumeAuthEntryParams(searchParams));
  const { redirectTo, email: entryEmail, oauthError } = entryParams;

  useAuthEntryUrlCleanup(router, "/signup", redirectTo, searchParams);

  return (
    <SignupCard>
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Create your account
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Sign up with Google or a one-time email code. One account per email.
        </p>
      </header>

      <AuthOAuthErrorBanner error={oauthError} className="mt-4" />

      <div className="mt-6">
        <AuthForm
          initialEmail={entryEmail ?? ""}
          redirectTo={redirectTo}
          showLoginLink={true}
          idPrefix="signup"
        />
      </div>
    </SignupCard>
  );
}

function SignupCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {children}
    </div>
  );
}
