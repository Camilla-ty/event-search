import { redirect } from "next/navigation";
import { Suspense } from "react";

import { SignupPageContent } from "@/src/app/(marketing)/signup/SignupPageContent";
import { safeRedirectTarget } from "@/src/lib/auth/safeRedirect";
import { createClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign up - HandShakes",
  description: "Join HandShakes to unlock sponsors, events, and the full event ecosystem.",
};

type SignupPageProps = {
  searchParams: Promise<{ redirect?: string; error?: string }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { redirect: redirectParam, error: oauthErrorParam } = await searchParams;
  const redirectTo = safeRedirectTarget(redirectParam, "/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(redirectTo);
  }

  const oauthError =
    typeof oauthErrorParam === "string" && oauthErrorParam.trim() !== ""
      ? oauthErrorParam.trim()
      : null;

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl animate-pulse space-y-4 p-6">
          <div className="h-8 w-48 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-4 w-full max-w-md rounded bg-slate-200 dark:bg-slate-800" />
        </div>
      }
    >
      <SignupPageContent oauthError={oauthError} />
    </Suspense>
  );
}
