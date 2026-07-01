"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { BrandWordmark } from "@/src/components/layout/BrandWordmark";
import { SessionControls } from "@/src/components/layout/NavigationShell";
import { SidebarNavItem } from "@/src/components/layout/SidebarNavItem";
import type { MarketingNavSession } from "@/src/lib/auth/marketingSession";
import { adminPrimaryNavItems } from "@/src/lib/constants/navigation";
import { brandLinkClass } from "@/src/lib/design/classes";

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
        <aside className="border-b border-slate-200 bg-white lg:fixed lg:inset-y-0 lg:w-[280px] lg:border-b-0 lg:border-r">
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
              <SessionControls mode="admin" session={session} variant="sidebar" />
            </div>
          </div>
        </aside>
        <div className="min-w-0 flex-1 lg:pl-[280px]">
          <main id="main-content" className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
