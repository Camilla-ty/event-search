import { redirect } from "next/navigation";
import { Suspense } from "react";

import { createClient } from "@/src/lib/supabase/server";
import { createPageMetadata } from "@/src/lib/metadata/site";
import { resolvePostAuthRedirect } from "@/src/lib/auth/resolvePostAuthRedirect";

import SignupForm from "./SignupForm";
import { SignupBackLink } from "./SignupBackLink";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "Sign up",
  path: "/signup",
  robots: { index: false, follow: true },
});

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
    <>
      <SignupBackLink />
      <Suspense
        fallback={
          <div className="h-56 animate-pulse rounded-xl bg-slate-100" aria-hidden />
        }
      >
        <SignupForm />
      </Suspense>
    </>
  );
}
