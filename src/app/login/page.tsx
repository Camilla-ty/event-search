import { redirect } from "next/navigation";
import { Suspense } from "react";

import { createClient } from "@/src/lib/supabase/server";
import { createPageMetadata } from "@/src/lib/metadata/site";
import { resolvePostAuthRedirect } from "@/src/lib/auth/resolvePostAuthRedirect";

import { LoginBackLink } from "./LoginBackLink";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "Log in",
  path: "/login",
});

type LoginPageProps = {
  searchParams: Promise<{ redirect?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
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
    <>
      <LoginBackLink />
      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-slate-100" aria-hidden />}>
        <LoginForm />
      </Suspense>
    </>
  );
}
