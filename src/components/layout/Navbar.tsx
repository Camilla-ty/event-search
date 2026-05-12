"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type NavbarItem = {
  href: string;
  label: string;
};

export type NavbarProps = {
  brand?: ReactNode;
  items: NavbarItem[];
  rightSlot?: ReactNode;
  className?: string;
  orientation?: "horizontal" | "vertical";
};

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar({
  brand,
  items,
  rightSlot,
  className,
  orientation = "horizontal",
}: NavbarProps) {
  const pathname = usePathname();
  const isVertical = orientation === "vertical";

  return (
    <nav
      aria-label="Primary navigation"
      className={[
        isVertical
          ? "h-full border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
          : "sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={[
          isVertical
            ? "flex h-full w-full flex-col gap-6 px-4 py-6"
            : "mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4",
        ].join(" ")}
      >
        <div className={isVertical ? "space-y-4" : "flex items-center gap-6"}>
          {brand ? (
            <div className={isVertical ? "px-2 text-lg font-semibold" : undefined}>{brand}</div>
          ) : null}
          <ul className={isVertical ? "space-y-1" : "flex items-center gap-2"}>
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
        </div>
        {rightSlot ? (
          <div className={isVertical ? "mt-auto flex items-center gap-2" : "flex items-center gap-2"}>
            {rightSlot}
          </div>
        ) : null}
      </div>
    </nav>
  );
}
