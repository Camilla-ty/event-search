"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/src/components/common";
import type { MarketingNavSession } from "@/src/lib/auth/marketingSession";
import {
  adminNavItems,
  primaryNavItems,
} from "@/src/lib/constants/navigation";
import type { NavItem } from "@/src/lib/constants/navigation";
import type { LayoutMode } from "@/src/lib/layout/layoutMode";
import {
  brandLinkClass,
  primaryCtaClass,
  secondaryCtaClass,
} from "@/src/lib/design/classes";
import { safeRedirectTarget } from "@/src/lib/auth/safeRedirect";
import { createClient } from "@/src/lib/supabase/client";

import { BrandWordmark } from "./BrandWordmark";
import { SidebarNavItem } from "./SidebarNavItem";

export type NavigationShellProps = {
  mode: LayoutMode;
  session: MarketingNavSession;
  adminEmail?: string | null;
};

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function PrimaryNavList({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const active = isActivePath(pathname, item.href);
        return (
          <li key={item.href}>
            <SidebarNavItem
              href={item.href}
              label={item.label}
              active={active}
              icon={item.icon}
            />
          </li>
        );
      })}
    </ul>
  );
}

export type SessionControlsVariant = "sidebar" | "mobile";

function readSessionDisplayName(session: MarketingNavSession): string {
  return session.label ?? session.email ?? "Account";
}

function readAvatarInitial(session: MarketingNavSession): string {
  const source = session.label?.trim() || session.email?.trim() || "";
  if (source === "") return "?";
  return source.charAt(0).toUpperCase();
}

function readSessionRoleLabel(
  session: MarketingNavSession,
  mode: LayoutMode,
): string {
  if (session.role === "admin") return "Administrator";
  if (session.role === "staff") return "Staff";
  if (session.role === "member") return "Member";
  if (mode === "admin" || session.isAdmin) return "Administrator";
  return "Member";
}

function SidebarProfileCard({
  session,
  mode,
}: {
  session: MarketingNavSession;
  mode: LayoutMode;
}) {
  const displayName = readSessionDisplayName(session);
  const title =
    session.label && session.email && session.label !== session.email
      ? `${session.label} (${session.email})`
      : (session.email ?? session.label ?? undefined);

  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex min-w-0 items-center gap-3">
        <div
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-primary-muted text-sm font-semibold text-brand-primary"
        >
          {readAvatarInitial(session)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900" title={title}>
            {displayName}
          </p>
          <p className="text-xs text-slate-500">{readSessionRoleLabel(session, mode)}</p>
        </div>
      </div>
    </div>
  );
}

export function SessionControls({
  mode,
  session: initial,
  className,
  variant = "mobile",
}: {
  mode: LayoutMode;
  session: MarketingNavSession;
  className?: string;
  variant?: SessionControlsVariant;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<MarketingNavSession>(initial);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    setSession(initial);
  }, [initial]);

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
      if (mode === "admin") {
        router.replace("/login");
      }
    } finally {
      setIsSigningOut(false);
    }
  }

  const redirectTarget = safeRedirectTarget(pathname);
  const loginHref = `/login?redirect=${encodeURIComponent(redirectTarget)}`;
  const signupHref = `/signup?redirect=${encodeURIComponent(redirectTarget)}`;

  const showGuestActions = mode === "marketing" && !session.isAuthenticated;

  return (
    <div className={["flex flex-col gap-2", className].filter(Boolean).join(" ")}>
      {showGuestActions ? (
        <>
          <Link href={signupHref} className={`${primaryCtaClass} h-9 w-full`}>
            Sign Up
          </Link>
          <Link href={loginHref} className={`${secondaryCtaClass} h-9 w-full`}>
            Log in
          </Link>
        </>
      ) : (
        <>
          {session.isAdmin && mode !== "admin" ? (
            <Link
              href="/admin"
              className={`${secondaryCtaClass} h-9 w-full text-center text-xs`}
            >
              Admin workspace
            </Link>
          ) : null}
          {session.isAuthenticated ? (
            variant === "sidebar" ? (
              <SidebarProfileCard session={session} mode={mode} />
            ) : (
              <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Signed in
                </p>
                <p
                  className="truncate text-sm font-medium text-slate-900"
                  title={session.label ?? session.email ?? undefined}
                >
                  {session.label ?? session.email ?? "Account"}
                </p>
              </div>
            )
          ) : null}
          {(session.isAuthenticated || mode === "admin") && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="w-full"
            >
              {isSigningOut ? "Signing out…" : "Log out"}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function SidebarNavigation({
  mode,
  session,
}: {
  mode: "marketing" | "app";
  session: MarketingNavSession;
}) {
  return (
    <nav aria-label="Primary navigation" className="flex h-full w-full flex-col px-3 py-6">
      <div className="mb-8 px-2">
        <BrandWordmark subtitle="Event intelligence" />
      </div>
      <PrimaryNavList items={primaryNavItems} />
      {session.isAdmin ? (
        <div className="mt-8 border-t border-slate-200 pt-6">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Data ops
          </p>
          <PrimaryNavList items={adminNavItems} />
        </div>
      ) : null}
      <div className="mt-auto border-t border-slate-200 pt-4">
        <SessionControls mode={mode} session={session} variant="sidebar" />
      </div>
    </nav>
  );
}

function AdminTopNavigation({
  session,
  adminEmail,
}: {
  session: MarketingNavSession;
  adminEmail?: string | null;
}) {
  return (
    <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-8 py-3">
      <BrandWordmark href="/admin" subtitle="Admin" compact />
      <div className="flex items-center gap-3 text-sm">
        {adminEmail ? (
          <span className="hidden text-slate-600 sm:inline">{adminEmail}</span>
        ) : null}
        <Link href="/" className={brandLinkClass}>
          Back to app
        </Link>
        <SessionControls mode="admin" session={session} />
      </div>
    </div>
  );
}

export function NavigationShell({ mode, session, adminEmail }: NavigationShellProps) {
  if (mode === "admin") {
    return (
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <AdminTopNavigation session={session} adminEmail={adminEmail} />
      </header>
    );
  }

  if (mode === "marketing" || mode === "app") {
    return (
      <aside className="hidden border-r border-slate-200 bg-white shadow-sm lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-[280px]">
        <SidebarNavigation mode={mode} session={session} />
      </aside>
    );
  }

  return null;
}
