"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { adminNavItems, publicNavItems } from "@/src/lib/constants/navigation";
import type { NavItem } from "@/src/lib/constants/navigation";

type MainNavProps = {
  sessionSlot?: ReactNode;
  isAdmin?: boolean;
};

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavSection({ title, items }: { title: string; items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <section className="space-y-2">
      <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </p>
      <ul className="space-y-1">
        {items.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "block rounded-md px-3 py-2 text-sm font-medium transition",
                  active
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100",
                ].join(" ")}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function MainNav({ sessionSlot, isAdmin = false }: MainNavProps) {
  return (
    <nav
      aria-label="Primary navigation"
      className="h-full border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
    >
      <div className="flex h-full w-full flex-col gap-6 px-4 py-6">
        <div className="px-2 text-lg font-semibold">HandsShakes</div>
        <NavSection title="Explore" items={publicNavItems} />
        {isAdmin ? <NavSection title="Admin" items={adminNavItems} /> : null}
        {sessionSlot ? <div className="mt-auto flex items-center gap-2">{sessionSlot}</div> : null}
      </div>
    </nav>
  );
}
