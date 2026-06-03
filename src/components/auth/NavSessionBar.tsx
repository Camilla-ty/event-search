"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/src/components/common";
import type { MarketingNavSession } from "@/src/lib/auth/marketingSession";
import { safeRedirectTarget } from "@/src/lib/auth/safeRedirect";
import { createClient } from "@/src/lib/supabase/client";

type NavSessionBarProps = {
  initial: MarketingNavSession;
  className?: string;
};

export function NavSessionBar({ initial, className }: NavSessionBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<MarketingNavSession>(initial);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    setSession(initial);
  }, [initial]);

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        router.refresh();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      setSession({
        isAuthenticated: false,
        isAdmin: false,
        role: null,
        label: null,
        email: null,
      });
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }

  const redirectTarget = safeRedirectTarget(pathname);
  const loginHref = `/login?redirect=${encodeURIComponent(redirectTarget)}`;
  const signupHref = `/signup?redirect=${encodeURIComponent(redirectTarget)}`;

  return (
    <div
      className={[
        "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {session.isAuthenticated ? (
        <>
          {session.isAdmin ? (
            <Link
              href="/admin"
              className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-violet-300 bg-violet-50 px-3 text-sm font-medium text-violet-700 transition hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 dark:border-violet-700 dark:bg-violet-900/20 dark:text-violet-300 dark:hover:bg-violet-900/40"
            >
              Admin
            </Link>
          ) : null}
          <div className="min-w-0 text-right sm:text-left">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Signed in
            </p>
            <p
              className="truncate text-sm font-medium text-slate-900 dark:text-slate-100"
              title={session.label ?? session.email ?? undefined}
            >
              {session.label ?? session.email ?? "Account"}
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="shrink-0"
          >
            {isSigningOut ? "Signing out…" : "Log out"}
          </Button>
        </>
      ) : (
        <>
          <Link
            href={signupHref}
            className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg bg-violet-600 px-3 text-sm font-medium text-white transition hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2"
          >
            Sign Up
          </Link>
          <Link
            href={loginHref}
            className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Log in
          </Link>
        </>
      )}
    </div>
  );
}
