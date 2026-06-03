"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { primaryNavItems } from "@/src/lib/constants/navigation";
import {
  mobileNavItemActiveClass,
  mobileNavItemInactiveClass,
} from "@/src/lib/design/classes";

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobilePrimaryNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary navigation"
      className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2 lg:hidden"
    >
      {primaryNavItems.map((item) => {
        const active = isActivePath(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={[
              "shrink-0 rounded-md px-3 py-1.5 text-sm transition",
              active ? mobileNavItemActiveClass : mobileNavItemInactiveClass,
            ].join(" ")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
