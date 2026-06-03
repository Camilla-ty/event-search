import { redirect } from "next/navigation";
import { Suspense } from "react";

import { createClient } from "@/src/lib/supabase/server";
import { resolvePostAuthRedirect } from "@/src/lib/auth/resolvePostAuthRedirect";

import SignupForm from "./SignupForm";
import { SignupBackLink } from "./SignupBackLink";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign up - HandShakes",
};

type SignupPageProps = {
  searchParams: Promise<{ redirect?: string; error?: string; email?: string }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { redirect: redirectParam } = await searchParams;
  const redirectTo = resolvePostAuthRedirect(redirectParam, "/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(redirectTo);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center p-6">
      <SignupBackLink />
      <Suspense
        fallback={
          <div className="h-56 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
        }
      >
        <SignupForm />
      </Suspense>
    </main>
  );
}
