"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { adminEventsSubNavItems } from "@/src/lib/constants/navigation";
import { navItemActiveClass, navItemInactiveClass } from "@/src/lib/design/classes";

function isEventsSubNavActive(pathname: string, href: string): boolean {
  if (href === "/admin/events") {
    return pathname === "/admin/events";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function EventsSubNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Events section"
      className="mb-6 flex flex-wrap gap-1 border-b border-slate-200 pb-3"
    >
      {adminEventsSubNavItems.map((item) => {
        const active = isEventsSubNavActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={[
              "rounded-md px-3 py-1.5 text-sm",
              active ? navItemActiveClass : navItemInactiveClass,
            ].join(" ")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
