"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/src/components/common";
import { createClient } from "@/src/lib/supabase/client";

const DEFAULT_REDIRECT = "/admin";

function safeRedirectTarget(raw: string | null): string {
  if (!raw) return DEFAULT_REDIRECT;
  // Only allow internal paths; ignore protocol-relative or absolute URLs to
  // prevent open-redirect via the `?redirect=...` query param.
  if (!raw.startsWith("/") || raw.startsWith("//")) return DEFAULT_REDIRECT;
  return raw;
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeRedirectTarget(searchParams.get("redirect"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      if (!data.user) {
        setError("Sign-in failed. Please try again.");
        return;
      }

      router.replace(redirectTo);
      router.refresh();
    } catch (submitError) {
      const message =
        submitError instanceof Error && submitError.message.trim() !== ""
          ? submitError.message.trim()
          : "Sign-in failed.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Sign in
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Authentication is required for HandShakes admin tools.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Email
          </span>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            disabled={isSubmitting}
            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            placeholder="you@example.com"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Password
          </span>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            disabled={isSubmitting}
            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      {error ? (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900 dark:border-rose-800 dark:bg-rose-950/90 dark:text-rose-100">
          {error}
        </div>
      ) : null}
    </div>
  );
}
