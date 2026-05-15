import { redirect } from "next/navigation";

import { createClient } from "@/src/lib/supabase/server";
import { safeRedirectTarget } from "@/src/lib/auth/safeRedirect";

import { LoginBackLink } from "./LoginBackLink";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Log in with email code - HandShakes",
};

type LoginPageProps = {
  searchParams: Promise<{ redirect?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { redirect: redirectParam } = await searchParams;
  const redirectTo = safeRedirectTarget(redirectParam, "/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(redirectTo);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center p-6">
      <LoginBackLink />
      <LoginForm />
    </main>
  );
}
