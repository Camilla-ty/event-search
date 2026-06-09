"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { adminPrimaryNavItems } from "@/src/lib/constants/navigation";
import {
  brandLinkClass,
  navItemActiveClass,
  navItemInactiveClass,
} from "@/src/lib/design/classes";

import { BrandWordmark } from "@/src/components/layout/BrandWordmark";
import { SessionControls } from "@/src/components/layout/NavigationShell";
import type { MarketingNavSession } from "@/src/lib/auth/marketingSession";

type AdminShellProps = {
  session: MarketingNavSession;
  adminEmail?: string | null;
  children: ReactNode;
};

function isAdminNavActive(pathname: string, href: string): boolean {
  if (href === "/admin") {
    return pathname === "/admin";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ session, adminEmail, children }: AdminShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-surface-page">
      <div className="lg:flex">
        <aside className="border-b border-slate-200 bg-white lg:fixed lg:inset-y-0 lg:w-56 lg:border-b-0 lg:border-r">
          <div className="flex h-full flex-col px-4 py-5">
            <div className="mb-6 px-1">
              <BrandWordmark href="/admin" subtitle="Admin" compact />
            </div>
            <nav aria-label="Admin navigation">
              <ul className="space-y-0.5">
                {adminPrimaryNavItems.map((item) => {
                  const active = isAdminNavActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={[
                          "block rounded-md px-3 py-2 text-sm",
                          active ? navItemActiveClass : navItemInactiveClass,
                        ].join(" ")}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <div className="mt-4 border-t border-slate-200 pt-4">
              <Link
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className={`block px-3 py-2 text-sm ${brandLinkClass}`}
              >
                View site ↗
              </Link>
            </div>
            <div className="mt-auto border-t border-slate-200 pt-4">
              {adminEmail ? (
                <p className="mb-2 truncate px-1 text-xs text-slate-500" title={adminEmail}>
                  {adminEmail}
                </p>
              ) : null}
              <SessionControls mode="admin" session={session} />
            </div>
          </div>
        </aside>
        <div className="min-w-0 flex-1 lg:pl-56">
          <main id="main-content" className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
